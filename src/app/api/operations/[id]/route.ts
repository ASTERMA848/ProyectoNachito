import { monetaryJson, positiveDecimal } from "@/lib/monetary";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { accountingDate, AccountingPeriodError, assertOpenAccountingPeriod, lockAccountingWrites } from "@/lib/accounting-period";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { isTreasury, TREASURY_LOCKED_MESSAGE } from "@/lib/operation-labels";
import { Prisma, Operation } from "@prisma/client";
import { reverseSaleLedger } from "@/lib/distributed-sale";

const VALID_STATES = ["PENDING", "PROCESSING", "COMPLETED", "CANCELED"];

const currencySelect = { id: true, code: true, symbol: true, decimals: true } as const;

// Ficha de una operación con sus líneas y los contadores de los botones inteligentes.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const operation = await prisma.operation.findFirst({
      where: { id: (await params).id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, lastname: true, document: true } },
        provider: { select: { id: true, name: true, lastname: true, document: true } },
        originCurrency: { select: currencySelect },
        destCurrency: { select: currencySelect },
        providerPaymentCurrency: { select: currencySelect },
        parentOperation: { select: { id: true, operationNumber: true } },
        childOperations: {
          where: { deletedAt: null },
          include: { client: { select: { id: true, name: true, lastname: true } } },
        },
      },
    });
    if (!operation) {
      return NextResponse.json({ error: "Operación no encontrada" }, { status: 404 });
    }
    // Las líneas se numeran OP-000123-1, -2... ; el orden numérico evita que "-10" quede antes que "-2".
    operation.childOperations.sort((a, b) => a.operationNumber.localeCompare(b.operationNumber, undefined, { numeric: true }));

    const ids = [operation.id, ...operation.childOperations.map((child) => child.id)];
    const [transactions, treasuryMovements] = await Promise.all([
      prisma.transaction.count({ where: { operationId: { in: ids } } }),
      prisma.treasuryMovement.count({ where: { operationId: { in: ids } } }),
    ]);

    return NextResponse.json(monetaryJson({ operation, counts: { transactions, treasuryMovements } }), { status: 200 });
  } catch (error) {
    console.error("Operation GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!can(user, "operations.write")) {
      return NextResponse.json({ error: "Tu rol no puede modificar operaciones" }, { status: 403 });
    }

    const operationId = (await params).id;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Extraer solo campos permitidos
    const {
      clientId, providerId, originCurrencyId, destCurrencyId,
      originAmount, destAmount, exchangeRate, operationDate,
      observations,
    } = body;

    // Validar campos requeridos
    if (!clientId || !providerId || !originCurrencyId || !destCurrencyId ||
        originAmount === undefined || destAmount === undefined ||
        exchangeRate === undefined || !operationDate) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const parsedOriginAmount = positiveDecimal(originAmount);
    const parsedDestAmount = positiveDecimal(destAmount);
    const parsedExchangeRate = positiveDecimal(exchangeRate);
    const parsedDate = new Date(operationDate);

    if (!parsedOriginAmount ||
        !parsedDestAmount ||
        !parsedExchangeRate ||
        isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Datos numéricos o de fecha inválidos" }, { status: 400 });
    }

    const updatedOperation = await prisma.$transaction(async (tx) => {
      const oldOperation = await lockOperation(tx, operationId);
      if (oldOperation.type.startsWith("DISTRIBUTED_SALE") || oldOperation.type === "SINGLE_SALE") {
        throw new PatchError("Editá la venta desde su formulario para actualizar pagos y saldos juntos", 400);
      }
      if (isTreasury(oldOperation.type)) throw new PatchError(TREASURY_LOCKED_MESSAGE, 400);
      if (oldOperation.state === "COMPLETED" && !can(user, "operations.reopen")) {
        throw new PatchError("Solo el administrador puede modificar operaciones completadas", 403);
      }
      await assertOpenAccountingPeriod(tx, oldOperation.operationDate, parsedDate);

      const updatedOperation = await tx.operation.update({
        where: { id: operationId },
        data: {
          clientId,
          providerId,
          originCurrencyId,
          destCurrencyId,
          originAmount: parsedOriginAmount,
          destAmount: parsedDestAmount,
          exchangeRate: parsedExchangeRate,
          operationDate: parsedDate,
          observations: observations ? String(observations).substring(0, 2000) : null,
          // Estado NO se puede cambiar por PUT — usar PATCH para cambio de estado
        },
      });

      const ledgerFields = ["clientId", "providerId", "originCurrencyId", "destCurrencyId", "originAmount", "destAmount"] as const;
      if (oldOperation.state === "COMPLETED" && ledgerFields.some((field) => String(oldOperation[field]) !== String(updatedOperation[field]))) {
        await reverseSaleLedger(tx, [operationId]);
        await applyOperationLedger(tx, updatedOperation, updatedOperation.isPaid);
      }

      const auditedFields = [...ledgerFields, "exchangeRate", "operationDate", "observations"] as const;
      await logAudit({
        userId: user.id,
        action: "UPDATE",
        entity: "Operation",
        entityId: operationId,
        oldValues: Object.fromEntries(auditedFields.map((field) => [field, oldOperation[field]])),
        newValues: Object.fromEntries(auditedFields.map((field) => [field, updatedOperation[field]])),
      }, tx);

      return updatedOperation;
    }, { maxWait: 10000, timeout: 20000 });

    return NextResponse.json(monetaryJson(updatedOperation), { status: 200 });
  } catch (error: any) {
    if (error instanceof PatchError || error instanceof AccountingPeriodError) return operationError(error);
    console.error("Operation PUT error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}

class PatchError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function operationError(error: PatchError | AccountingPeriodError) {
  return NextResponse.json({ error: error.message }, { status: error instanceof PatchError ? error.status : 400 });
}

async function lockOperation(tx: Prisma.TransactionClient, id: string) {
  await lockAccountingWrites(tx);
  await tx.$queryRaw`SELECT id FROM "Operation" WHERE id = ${id} FOR UPDATE`;
  const operation = await tx.operation.findFirst({ where: { id, deletedAt: null } });
  if (!operation) throw new PatchError("Operación no encontrada", 404);
  return operation;
}

// Qué impacto contable corresponde a cada combinación de estado y pago.
// Una operación solo mueve cuentas corrientes al completarse, y tesorería si además está pagada.
function ledgerLevel(state: string, isPaid: boolean) {
  if (state !== "COMPLETED") return "NONE";
  return isPaid ? "PAID" : "COMMERCIAL";
}

async function applyOperationLedger(tx: Prisma.TransactionClient, op: Operation, withPayment: boolean) {
  const { id, clientId, providerId, originCurrencyId, destCurrencyId, originAmount, destAmount, operationNumber } = op;

  // Incremento atómico: el saldo resultante sale de la base, no de una lectura previa.
  const applyTransaction = async (contactId: string, currencyId: string, amount: Prisma.Decimal, concept: string) => {
    const account = await tx.account.upsert({
      where: { contactId_currencyId: { contactId, currencyId } },
      create: { contactId, currencyId, balance: amount },
      update: { balance: { increment: amount } },
    });
    await tx.transaction.create({
      data: {
        accountId: account.id,
        concept: concept.substring(0, 500),
        credit: amount.isPositive() ? amount : 0,
        debit: amount.isNegative() ? amount.abs() : 0,
        balance: account.balance,
        operationId: id,
      },
    });
  };

  const applyTreasuryAndSettle = async (contactId: string, currencyId: string, amount: Prisma.Decimal, conceptSettlement: string, conceptTreasury: string) => {
    await applyTransaction(contactId, currencyId, amount.negated(), conceptSettlement);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72641002)`;
    let tAccount = await tx.treasuryAccount.findFirst({
      where: { currencyId, type: "CASH", isActive: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!tAccount) {
      const curr = await tx.currency.findUnique({ where: { id: currencyId } });
      tAccount = await tx.treasuryAccount.create({
        data: { name: `Caja Principal ${curr?.code}`, type: "CASH", currencyId, balance: 0 },
      });
    }
    await tx.treasuryAccount.update({
      where: { id: tAccount.id },
      data: { balance: { increment: amount } },
    });
    await tx.treasuryMovement.create({
      data: {
        treasuryAccountId: tAccount.id,
        operationId: id,
        type: amount.isPositive() ? "INCOME" : "EXPENSE",
        amount: amount.abs(),
        concept: conceptTreasury,
      },
    });
  };

  // 1. Deuda Comercial
  if (clientId) {
    await applyTransaction(clientId, originCurrencyId, originAmount, `Operación ${operationNumber} - Entrega Origen`);
    await applyTransaction(clientId, destCurrencyId, destAmount.negated(), `Operación ${operationNumber} - Recepción Destino`);
  }
  if (providerId) {
    await applyTransaction(providerId, originCurrencyId, originAmount.negated(), `Operación ${operationNumber} - Recepción Origen`);
    await applyTransaction(providerId, destCurrencyId, destAmount, `Operación ${operationNumber} - Entrega Destino`);
  }

  // 2. Liquidación y Tesorería
  if (!withPayment) return;
  if (clientId) {
    await applyTreasuryAndSettle(clientId, originCurrencyId, originAmount, `Cobro/Pago Op. ${operationNumber} - Origen`, `Ingreso por Op. ${operationNumber} (Cliente)`);
    await applyTreasuryAndSettle(clientId, destCurrencyId, destAmount.negated(), `Cobro/Pago Op. ${operationNumber} - Destino`, `Egreso por Op. ${operationNumber} (Cliente)`);
  }
  if (providerId) {
    await applyTreasuryAndSettle(providerId, originCurrencyId, originAmount.negated(), `Cobro/Pago Op. ${operationNumber} - Origen`, `Egreso por Op. ${operationNumber} (Proveedor)`);
    await applyTreasuryAndSettle(providerId, destCurrencyId, destAmount, `Cobro/Pago Op. ${operationNumber} - Destino`, `Ingreso por Op. ${operationNumber} (Proveedor)`);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!can(user, "operations.write")) {
      return NextResponse.json({ error: "Tu rol no puede cambiar el estado de las operaciones" }, { status: 403 });
    }

    const operationId = (await params).id;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { state, isPaid } = body;

    // Validar estado si se envió
    if (state && !VALID_STATES.includes(state)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATES.join(", ")}` },
        { status: 400 }
      );
    }
    if (isPaid !== undefined && typeof isPaid !== "boolean") {
      return NextResponse.json({ error: "Valor de pago inválido" }, { status: 400 });
    }

    // Todo en una transacción: o se aplica el cambio completo o no se aplica nada.
    const updatedOperation = await prisma.$transaction(async (tx) => {
      const oldOperation = await lockOperation(tx, operationId);
      if (oldOperation.type.startsWith("DISTRIBUTED_SALE") || oldOperation.type === "SINGLE_SALE") {
        throw new PatchError("Actualizá los cobros y el pago al proveedor desde Editar venta distribuida", 400);
      }
      // Reabrir revertiría sus movimientos de caja y completarla de nuevo no los vuelve a cargar.
      if (isTreasury(oldOperation.type)) {
        throw new PatchError(TREASURY_LOCKED_MESSAGE, 400);
      }
      if (oldOperation.state === "COMPLETED" && ((state && state !== "COMPLETED") || (isPaid !== undefined && isPaid !== oldOperation.isPaid)) && !can(user, "operations.reopen")) {
        throw new PatchError("Solo el administrador puede modificar operaciones completadas", 403);
      }

      await assertOpenAccountingPeriod(tx, oldOperation.operationDate);

      const newState: string = state || oldOperation.state;
      const newIsPaid: boolean = typeof isPaid === "boolean" ? isPaid : oldOperation.isPaid;

      const updatedOperation = await tx.operation.update({
        where: { id: operationId },
        data: { state: newState, isPaid: newIsPaid },
        include: {
          client: true,
          provider: true,
          originCurrency: true,
          destCurrency: true,
        },
      });

      if (newState !== oldOperation.state) {
        await tx.operationStateHistory.create({
          data: { operationId, oldState: oldOperation.state, newState, changedBy: user.id },
        });
      }

      // Si cambia el impacto contable, se revierte lo registrado para esta operación
      // y se vuelve a aplicar según el estado final. Reabrir una operación completada
      // deja sus saldos como antes de completarla.
      if (ledgerLevel(oldOperation.state, oldOperation.isPaid) !== ledgerLevel(newState, newIsPaid)) {
        await reverseSaleLedger(tx, [operationId]);
        if (newState === "COMPLETED") {
          await applyOperationLedger(tx, updatedOperation, newIsPaid);
        }
      }

      await logAudit({
        userId: user.id,
        action: "UPDATE_STATE_OR_PAY",
        entity: "Operation",
        entityId: operationId,
        oldValues: { state: oldOperation.state, isPaid: oldOperation.isPaid },
        newValues: { state: updatedOperation.state, isPaid: updatedOperation.isPaid },
      }, tx);
      return updatedOperation;
    }, { maxWait: 10000, timeout: 20000 });

    return NextResponse.json(monetaryJson(updatedOperation), { status: 200 });
  } catch (error: any) {
    if (error instanceof PatchError || error instanceof AccountingPeriodError) return operationError(error);
    console.error("Operation PATCH error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!can(user, "operations.delete")) {
      return NextResponse.json({ error: "Solo el administrador puede eliminar operaciones" }, { status: 403 });
    }

    const operationId = (await params).id;

    await prisma.$transaction(async (tx) => {
      const operation = await lockOperation(tx, operationId);
      if (operation.parentOperationId) throw new PatchError("Editá las líneas desde la operación principal", 400);
      await assertOpenAccountingPeriod(tx, accountingDate(operation));

      const children = await tx.operation.findMany({
        where: { parentOperationId: operationId, deletedAt: null },
        select: { id: true, operationDate: true },
      });
      if (children.length) await assertOpenAccountingPeriod(tx, ...children.map((child) => child.operationDate));
      const ids = [operationId, ...children.map((child) => child.id)];
      await reverseSaleLedger(tx, ids);
      await tx.settlement.deleteMany({ where: { operationId: { in: ids } } });
      await tx.operation.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date(), state: "CANCELED" },
      });
      await logAudit({
        userId: user.id,
        action: "DELETE",
        entity: "Operation",
        entityId: operationId,
        oldValues: { operationNumber: operation.operationNumber, state: operation.state },
      }, tx);
    }, { maxWait: 10000, timeout: 20000 });

    return NextResponse.json({ success: true, message: "Operación eliminada y saldos ajustados" }, { status: 200 });
  } catch (error: any) {
    if (error instanceof PatchError || error instanceof AccountingPeriodError) return operationError(error);
    console.error("Operation DELETE error:", error);
    return NextResponse.json({ error: "Error al eliminar la operación" }, { status: 500 });
  }
}
