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
    const result = await prisma.$transaction(async (tx) => {
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

      const childOperations = [];

      // 2. Crear Operaciones Hijas por cada línea y sus movimientos en Cuentas Corrientes
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemAmount = parseFloat(item.amount);
        const itemDestAmount = itemAmount * parsedRate;
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
            exchangeRate: parsedRate,
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

        // Movimiento 1: Débito por entrega de divisa (Aumenta saldo)
        const balanceAfterDebit = clientAccount.balance + itemAmount;
        await tx.account.update({
          where: { id: clientAccount.id },
          data: { balance: balanceAfterDebit },
        });

        await tx.transaction.create({
          data: {
            accountId: clientAccount.id,
            operationId: childOp.id,
            concept: `Venta divisa (Op: ${childOpNumber})`,
            debit: itemAmount,
            credit: 0,
            balance: balanceAfterDebit,
            observations: item.observations || null,
          },
        });

        clientAccount.balance = balanceAfterDebit;

        // Movimiento 2: Si está pagado (Cobro al contado), registrar Crédito que cancela la deuda
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
              concept: `Pago al contado (Op: ${childOpNumber})`,
              debit: 0,
              credit: itemAmount,
              balance: balanceAfterCredit,
              observations: `Pago contado - ${item.observations || ""}`,
            },
          });
        }
      }

      return { parentOp, childOperations };
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
