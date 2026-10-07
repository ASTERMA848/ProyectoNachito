import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const {
      providerId,
      currencyId,
      exchangeRate,
      operationDate,
      observations,
      items,
    } = body;

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

    // Moneda destino base (ARS)
    let destCurrency = await prisma.currency.findFirst({
      where: { code: "ARS", isActive: true },
    });
    if (!destCurrency) {
      destCurrency = originCurrency;
    }

    // Ejecución Atómica en Transacción
    const result = await prisma.$transaction(
      async (tx) => {
      // Calcular totales
      const totalOriginAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const totalDestAmount = totalOriginAmount * parsedRate;

      const paidCount = items.filter((item) => !!item.isPaid).length;
      let parentState = "PENDING";
      if (paidCount === items.length) {
        parentState = "COMPLETED";
      } else if (paidCount > 0) {
        parentState = "PARTIAL";
      }

      // Generar número correlativo para la Operación Padre
      const count = await tx.operation.count();
      const parentOpNumber = `OP-${String(count + 1).padStart(6, "0")}`;

      // 1. Crear Operación Padre (Agrupadora)
      const parentOp = await tx.operation.create({
        data: {
          operationNumber: parentOpNumber,
          type: "DISTRIBUTED_SALE",
          providerId,
          clientId: null,
          originCurrencyId: currencyId,
          destCurrencyId: destCurrency.id,
          originAmount: totalOriginAmount,
          destAmount: totalDestAmount,
          exchangeRate: parsedRate,
          operationDate: parsedDate,
          observations: observations ? String(observations).substring(0, 2000) : null,
          state: parentState,
          isPaid: paidCount === items.length,
        },
      });

      // 2. Registrar Movimiento en Cuenta Corriente del Proveedor (Compra acumulada)
      let providerAccount = await tx.account.findUnique({
        where: {
          contactId_currencyId: {
            contactId: providerId,
            currencyId,
          },
        },
      });

      if (!providerAccount) {
        providerAccount = await tx.account.create({
          data: {
            contactId: providerId,
            currencyId,
            balance: 0,
          },
        });
      }

      // Proveedor entrega divisa (Nos genera una deuda con el proveedor por el total originAmount en la divisa o ARS)
      // Usamos la convención del sistema: DEBIT disminuye saldo, CREDIT aumenta saldo.
      // Como nos endeudamos (net asset decrease), usamos DEBIT.
      const providerBalanceAfter = providerAccount.balance - totalOriginAmount;
      await tx.account.update({
        where: { id: providerAccount.id },
        data: { balance: providerBalanceAfter },
      });

      await tx.transaction.create({
        data: {
          accountId: providerAccount.id,
          operationId: parentOp.id,
          concept: `Compra de divisa (Op Agrupadora: ${parentOpNumber})`,
          debit: totalOriginAmount,
          credit: 0,
          balance: providerBalanceAfter,
          observations: `Cotización Proveedor: ${parsedRate}. Costo ARS: $${totalDestAmount.toLocaleString("es-AR")}`,
        },
      });

      // Si está pagado (Proveedor), liquidamos deuda y movemos cajas.
      // Como pagamos (net asset increase), usamos CREDIT.
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
              concept: `Pago al contado registrado (Op: ${parentOpNumber})`,
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
           data: { treasuryAccountId: tAccOrigin.id, type: "INCOME", amount: totalOriginAmount, operationId: parentOp.id, concept: `Ingreso divisa por Op ${parentOpNumber}` }
         });

         let tAccDest = await tx.treasuryAccount.findFirst({ where: { currencyId: destCurrency.id } });
         if (!tAccDest) tAccDest = await tx.treasuryAccount.create({ data: { name: `Caja Base`, currencyId: destCurrency.id, balance: 0, type: "CASH" } });
         await tx.treasuryAccount.update({ where: { id: tAccDest.id }, data: { balance: { decrement: totalDestAmount } } });
         await tx.treasuryMovement.create({
           data: { treasuryAccountId: tAccDest.id, type: "EXPENSE", amount: totalDestAmount, operationId: parentOp.id, concept: `Egreso base por Op ${parentOpNumber}` }
         });
      }

      const childOperations: any[] = [];


      // 3. Crear Operaciones Hijas por cada línea y sus movimientos en Cuentas Corrientes
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemAmount = parseFloat(item.amount);
        const itemRate = item.exchangeRate && !isNaN(parseFloat(item.exchangeRate)) ? parseFloat(item.exchangeRate) : parsedRate;
        const itemDestAmount = itemAmount * itemRate;
        const itemPaid = !!item.isPaid;
        const childOpNumber = `${parentOpNumber}-${i + 1}`;

        const childOp = await tx.operation.create({
          data: {
            operationNumber: childOpNumber,
            type: "DISTRIBUTED_SALE_ITEM",
            parentOperationId: parentOp.id,
            providerId,
            clientId: item.clientId,
            originCurrencyId: currencyId,
            destCurrencyId: destCurrency.id,
            originAmount: itemAmount,
            destAmount: itemDestAmount,
            exchangeRate: itemRate,
            operationDate: parsedDate,
            observations: item.observations ? String(item.observations).substring(0, 2000) : null,
            state: itemPaid ? "COMPLETED" : "PENDING",
            isPaid: itemPaid,
          },
        });

        childOperations.push(childOp);

        // Actualizar Cuenta Corriente del Cliente (Account & Transaction)
        let clientAccount = await tx.account.findUnique({
          where: {
            contactId_currencyId: {
              contactId: item.clientId,
              currencyId,
            },
          },
        });

        if (!clientAccount) {
          clientAccount = await tx.account.create({
            data: {
              contactId: item.clientId,
              currencyId,
              balance: 0,
            },
          });
        }

        // Movimiento 1: Venta de divisa (Aumenta saldo adeudado por el cliente, net asset increase -> CREDIT)
        const balanceAfterDebit = clientAccount.balance + itemAmount;
        await tx.account.update({
          where: { id: clientAccount.id },
          data: { balance: balanceAfterDebit },
        });

        await tx.transaction.create({
          data: {
            accountId: clientAccount.id,
            operationId: childOp.id,
            concept: `Venta divisa a cliente (Op: ${childOpNumber})`,
            debit: 0,
            credit: itemAmount,
            balance: balanceAfterDebit,
            observations: `Cotización Venta: ${itemRate}. Total ARS: $${itemDestAmount.toLocaleString("es-AR")}. ${item.observations || ""}`,
          },
        });

        clientAccount.balance = balanceAfterDebit;

        // Movimiento 2: Si está pagado (Cobro al contado), liquidamos deuda (net asset decrease -> DEBIT)
        if (itemPaid) {
          const balanceAfterCredit = clientAccount.balance - itemAmount;
          await tx.account.update({
            where: { id: clientAccount.id },
            data: { balance: balanceAfterCredit },
          });

          await tx.transaction.create({
            data: {
              accountId: clientAccount.id,
              operationId: childOp.id,
              concept: `Pago al contado registrado (Op: ${childOpNumber})`,
              debit: itemAmount,
              credit: 0,
              balance: balanceAfterCredit,
              observations: `Cancelación de deuda por venta cobrada en el acto - ${item.observations || ""}`,
            },
          });

          // Cajas: Sale Divisa, Entra Pesos (destCurrency)
          let tAccOrigin = await tx.treasuryAccount.findFirst({ where: { currencyId } });
          if (!tAccOrigin) tAccOrigin = await tx.treasuryAccount.create({ data: { name: `Caja ${originCurrency.code}`, currencyId, balance: 0, type: "CASH" } });
          await tx.treasuryAccount.update({ where: { id: tAccOrigin.id }, data: { balance: { decrement: itemAmount } } });
          await tx.treasuryMovement.create({
            data: { treasuryAccountId: tAccOrigin.id, type: "EXPENSE", amount: itemAmount, operationId: childOp.id, concept: `Egreso divisa por venta Op ${childOpNumber}` }
          });

          let tAccDest = await tx.treasuryAccount.findFirst({ where: { currencyId: destCurrency.id } });
          if (!tAccDest) tAccDest = await tx.treasuryAccount.create({ data: { name: `Caja Base`, currencyId: destCurrency.id, balance: 0, type: "CASH" } });
          await tx.treasuryAccount.update({ where: { id: tAccDest.id }, data: { balance: { increment: itemDestAmount } } });
          await tx.treasuryMovement.create({
            data: { treasuryAccountId: tAccDest.id, type: "INCOME", amount: itemDestAmount, operationId: childOp.id, concept: `Ingreso base por venta Op ${childOpNumber}` }
          });
        }
      }

      return { parentOp, childOperations };
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entity: "Operation",
      entityId: result.parentOp.id,
      newValues: {
        operationNumber: result.parentOp.operationNumber,
        type: "DISTRIBUTED_SALE",
        totalAmount: result.parentOp.originAmount,
        itemCount: items.length,
        state: result.parentOp.state,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Distributed Sale POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar la operación distribuida" },
      { status: 500 }
    );
  }
}

