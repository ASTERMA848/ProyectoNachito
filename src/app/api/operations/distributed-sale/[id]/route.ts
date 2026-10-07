import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const parentOpId = params.id;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { providerId, currencyId, exchangeRate, operationDate, observations, items } = body;

    // Validar cabecera requerida
    if (!providerId || !currencyId || exchangeRate === undefined || !operationDate) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios en la cabecera (Proveedor, Moneda, Cotización o Fecha)" },
        { status: 400 }
      );
    }

    const parsedRate = parseFloat(exchangeRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      return NextResponse.json(
        { error: "La cotización debe ser un número positivo" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(operationDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Fecha de operación inválida" }, { status: 400 });
    }

    // Validar ítems / líneas
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Debe ingresar al menos una línea de cliente" },
        { status: 400 }
      );
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.clientId) {
        return NextResponse.json(
          { error: `Falta seleccionar el cliente en la línea #${i + 1}` },
          { status: 400 }
        );
      }
      const val = parseFloat(item.amount);
      if (isNaN(val) || val <= 0) {
        return NextResponse.json(
          { error: `El monto en la línea #${i + 1} debe ser mayor a 0` },
          { status: 400 }
        );
      }
    }

    // Verificar proveedor y moneda en BD
    const [provider, originCurrency] = await Promise.all([
      prisma.contact.findFirst({ where: { id: providerId, deletedAt: null } }),
      prisma.currency.findFirst({ where: { id: currencyId, isActive: true } }),
    ]);

    if (!provider || !originCurrency) {
      return NextResponse.json(
        { error: "Proveedor o moneda no encontrados" },
        { status: 404 }
      );
    }

    const op = await prisma.operation.findFirst({
      where: { id: parentOpId, deletedAt: null, type: "DISTRIBUTED_SALE" },
      include: { childOperations: { where: { deletedAt: null }, orderBy: { operationNumber: "asc" } } },
    });

    if (!op) {
      return NextResponse.json({ error: "Operación distribuida no encontrada" }, { status: 404 });
    }

    // Moneda destino base (ARS)
    let destCurrency = await prisma.currency.findFirst({
      where: { code: "ARS", isActive: true },
    });
    if (!destCurrency) {
      destCurrency = originCurrency;
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const opsToReverse = [op, ...(op.childOperations || [])];
        for (const currentOp of opsToReverse) {
          // 1. Revertir impacto en Cuentas Corrientes y eliminar transacciones viejas
          const txs = await tx.transaction.findMany({
            where: { operationId: currentOp.id },
            include: { account: true },
          });

          for (const transaction of txs) {
            const account = transaction.account;
            if (!account) continue;

            const adjustment = transaction.debit - transaction.credit;
            const newBalance = account.balance + adjustment;

            await tx.account.update({
              where: { id: account.id },
              data: { balance: newBalance },
            });
          }
          await tx.transaction.deleteMany({ where: { operationId: currentOp.id } });

          // 2. Revertir impacto en Cajas / Tesorería y eliminar movimientos viejos
          const treasuryMovements = await tx.treasuryMovement.findMany({
            where: { operationId: currentOp.id }
          });
          
          for (const tmov of treasuryMovements) {
             const tAcc = await tx.treasuryAccount.findUnique({ where: { id: tmov.treasuryAccountId }});
             if (tAcc) {
                const adj = tmov.type === "INCOME" ? -tmov.amount : tmov.amount;
                await tx.treasuryAccount.update({
                  where: { id: tAcc.id },
                  data: { balance: { increment: adj } }
                });
             }
          }
          await tx.treasuryMovement.deleteMany({ where: { operationId: currentOp.id } });
        }

        // 2. CALC NEW TOTALS & UPDATE PARENT
        const totalOriginAmount = items.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
        const totalDestAmount = totalOriginAmount * parsedRate;
        const paidCount = items.filter((item: any) => !!item.isPaid).length;
        let parentState = "PENDING";
        if (paidCount === items.length) {
          parentState = "COMPLETED";
        } else if (paidCount > 0) {
          parentState = "PARTIAL";
        }

        const parentOp = await tx.operation.update({
          where: { id: op.id },
          data: {
            providerId,
            originCurrencyId: currencyId,
            destCurrencyId: destCurrency!.id,
            originAmount: totalOriginAmount,
            destAmount: totalDestAmount,
            exchangeRate: parsedRate,
            operationDate: parsedDate,
            observations: observations ? String(observations).substring(0, 2000) : null,
            state: parentState,
            isPaid: paidCount === items.length,
          },
        });

        // 3. APPLY PARENT NEW CC & TREASURY
        // A) Deuda Comercial (Proveedor nos entrega divisa, nos genera deuda en Divisa, net asset decrease -> DEBIT)
        let providerAccount = await tx.account.findUnique({
          where: { contactId_currencyId: { contactId: providerId, currencyId } },
        });
        if (!providerAccount) {
          providerAccount = await tx.account.create({ data: { contactId: providerId, currencyId, balance: 0, type: "CASH" } });
        }
        const providerBalanceAfter = providerAccount.balance - totalOriginAmount;
        await tx.account.update({
          where: { id: providerAccount.id },
          data: { balance: providerBalanceAfter },
        });
        await tx.transaction.create({
          data: {
            accountId: providerAccount.id,
            operationId: parentOp.id,
            concept: `Compra de divisa (Op Agrupadora: ${parentOp.operationNumber})`,
            debit: totalOriginAmount,
            credit: 0,
            balance: providerBalanceAfter,
            observations: `Edición - Cotización Proveedor: ${parsedRate}. Costo ARS: $${totalDestAmount.toLocaleString("es-AR")}`,
          },
        });

        // B) Si está pagado (Proveedor), liquidamos deuda (net asset increase -> CREDIT)
        if (parentOp.isPaid) {
           const pBalanceAfterPay = providerBalanceAfter + totalOriginAmount;
           await tx.account.update({
             where: { id: providerAccount.id },
             data: { balance: pBalanceAfterPay }
           });
           await tx.transaction.create({
              data: {
                accountId: providerAccount.id,
                operationId: parentOp.id,
                concept: `Pago al contado registrado (Op: ${parentOp.operationNumber})`,
                debit: 0,
                credit: totalOriginAmount,
                balance: pBalanceAfterPay,
                observations: "Cancelación de deuda por compra"
              }
           });

           // Cajas: Sale Pesos (destCurrency), Entra Divisa (originCurrency)
           let tAccOrigin = await tx.treasuryAccount.findFirst({ where: { currencyId } });
           if (!tAccOrigin) tAccOrigin = await tx.treasuryAccount.create({ data: { name: `Caja ${originCurrency.code}`, currencyId, balance: 0, type: "CASH" } });
           await tx.treasuryAccount.update({ where: { id: tAccOrigin.id }, data: { balance: { increment: totalOriginAmount } } });
           await tx.treasuryMovement.create({
             data: { treasuryAccountId: tAccOrigin.id, type: "INCOME", amount: totalOriginAmount, operationId: parentOp.id, concept: `Ingreso divisa por Op ${parentOp.operationNumber}` }
           });

           let tAccDest = await tx.treasuryAccount.findFirst({ where: { currencyId: destCurrency!.id } });
           if (!tAccDest) tAccDest = await tx.treasuryAccount.create({ data: { name: `Caja Base`, currencyId: destCurrency!.id, balance: 0, type: "CASH" } });
           await tx.treasuryAccount.update({ where: { id: tAccDest.id }, data: { balance: { decrement: totalDestAmount } } });
           await tx.treasuryMovement.create({
             data: { treasuryAccountId: tAccDest.id, type: "EXPENSE", amount: totalDestAmount, operationId: parentOp.id, concept: `Egreso base por Op ${parentOp.operationNumber}` }
           });
        }

        // 4. UPDATE / CREATE CHILDREN
        const existingChildren = op.childOperations || [];
        const newChildOperations = [];

        for (let i = 0; i < Math.max(items.length, existingChildren.length); i++) {
          if (i < items.length) {
            const item = items[i];
            const itemAmount = parseFloat(item.amount);
            const itemRate = item.exchangeRate && !isNaN(parseFloat(item.exchangeRate)) ? parseFloat(item.exchangeRate) : parsedRate;
            const itemDestAmount = itemAmount * itemRate;
            const itemPaid = !!item.isPaid;

            let childOp;
            if (i < existingChildren.length) {
              childOp = await tx.operation.update({
                where: { id: existingChildren[i].id },
                data: {
                  providerId,
                  clientId: item.clientId,
                  originCurrencyId: currencyId,
                  destCurrencyId: destCurrency!.id,
                  originAmount: itemAmount,
                  destAmount: itemDestAmount,
                  exchangeRate: itemRate,
                  operationDate: parsedDate,
                  observations: item.observations ? String(item.observations).substring(0, 2000) : null,
                  state: itemPaid ? "COMPLETED" : "PENDING",
                  isPaid: itemPaid,
                }
              });
            } else {
              const childOpNumber = `${parentOp.operationNumber}-${i + 1}`;
              childOp = await tx.operation.create({
                data: {
                  operationNumber: childOpNumber,
                  type: "DISTRIBUTED_SALE_ITEM",
                  parentOperationId: parentOp.id,
                  providerId,
                  clientId: item.clientId,
                  originCurrencyId: currencyId,
                  destCurrencyId: destCurrency!.id,
                  originAmount: itemAmount,
                  destAmount: itemDestAmount,
                  exchangeRate: itemRate,
                  operationDate: parsedDate,
                  observations: item.observations ? String(item.observations).substring(0, 2000) : null,
                  state: itemPaid ? "COMPLETED" : "PENDING",
                  isPaid: itemPaid,
                }
              });
            }
            newChildOperations.push(childOp);

            // A) Cuenta Corriente Cliente (Le damos Divisa, nos debe Divisa, net asset increase -> CREDIT)
            let clientAccount = await tx.account.findUnique({
              where: { contactId_currencyId: { contactId: item.clientId, currencyId } },
            });
            if (!clientAccount) {
              clientAccount = await tx.account.create({ data: { contactId: item.clientId, currencyId, balance: 0, type: "CASH" } });
            }
            const balanceAfterDebit = clientAccount.balance + itemAmount;
            await tx.account.update({
              where: { id: clientAccount.id },
              data: { balance: balanceAfterDebit },
            });
            await tx.transaction.create({
              data: {
                accountId: clientAccount.id,
                operationId: childOp.id,
                concept: `Venta divisa a cliente (Op: ${childOp.operationNumber})`,
                debit: 0,
                credit: itemAmount,
                balance: balanceAfterDebit,
                observations: `Edición - Cotización Venta: ${itemRate}. Total ARS: $${itemDestAmount.toLocaleString("es-AR")}`,
              },
            });

            // B) Si el cliente pagó, liquidar deuda (net asset decrease -> DEBIT)
            if (itemPaid) {
               const balanceAfterCredit = balanceAfterDebit - itemAmount;
               await tx.account.update({
                 where: { id: clientAccount.id },
                 data: { balance: balanceAfterCredit }
               });
               await tx.transaction.create({
                 data: {
                   accountId: clientAccount.id,
                   operationId: childOp.id,
                   concept: `Pago al contado registrado (Op: ${childOp.operationNumber})`,
                   debit: itemAmount,
                   credit: 0,
                   balance: balanceAfterCredit,
                   observations: "Cancelación de deuda por venta"
                 }
               });

               // Cajas: Sale Divisa, Entra Pesos (destCurrency)
               let tAccOrigin = await tx.treasuryAccount.findFirst({ where: { currencyId } });
               if (!tAccOrigin) tAccOrigin = await tx.treasuryAccount.create({ data: { name: `Caja ${originCurrency.code}`, currencyId, balance: 0, type: "CASH" } });
               await tx.treasuryAccount.update({ where: { id: tAccOrigin.id }, data: { balance: { decrement: itemAmount } } });
               await tx.treasuryMovement.create({
                 data: { treasuryAccountId: tAccOrigin.id, type: "EXPENSE", amount: itemAmount, operationId: childOp.id, concept: `Egreso divisa por venta Op ${childOp.operationNumber}` }
               });

               let tAccDest = await tx.treasuryAccount.findFirst({ where: { currencyId: destCurrency!.id } });
               if (!tAccDest) tAccDest = await tx.treasuryAccount.create({ data: { name: `Caja Base`, currencyId: destCurrency!.id, balance: 0, type: "CASH" } });
               await tx.treasuryAccount.update({ where: { id: tAccDest.id }, data: { balance: { increment: itemDestAmount } } });
               await tx.treasuryMovement.create({
                 data: { treasuryAccountId: tAccDest.id, type: "INCOME", amount: itemDestAmount, operationId: childOp.id, concept: `Ingreso base por venta Op ${childOp.operationNumber}` }
               });
            }

          } else {
            // Soft delete excess child
            const childToDelete = existingChildren[i];
            await tx.operation.update({
              where: { id: childToDelete.id },
              data: {
                deletedAt: new Date(),
                operationNumber: `${childToDelete.operationNumber}-DEL-${Date.now()}`
              }
            });
          }
        }

        return { parentOp, childOperations: newChildOperations };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Operation",
      entityId: result.parentOp.id,
      newValues: {
        operationNumber: result.parentOp.operationNumber,
        state: result.parentOp.state,
        updated: true
      },
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("Distributed Sale PUT error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar la operación distribuida" },
      { status: 500 }
    );
  }
}

