import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { verifyPassword } from "@/lib/auth-utils";
import { logAudit } from "@/lib/audit";
import { Prisma, Operation } from "@prisma/client";
import { reverseSaleLedger } from "@/lib/distributed-sale";

const VALID_STATES = ["PENDING", "PROCESSING", "COMPLETED", "CANCELED"];

/**
 * Verifica la contraseña del admin para operaciones sensibles.
 * El admin actual debe autenticarse con su propia contraseña — no una hardcodeada.
 */
async function verifyAdminPassword(userId: string, password: string): Promise<boolean> {
  if (!password || password.length > 128) return false;
  const adminUser = await prisma.user.findFirst({
    where: { id: userId, role: "ADMIN", isActive: true },
    select: { passwordHash: true },
  });
  if (!adminUser) return false;
  return verifyPassword(password, adminUser.passwordHash);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const operationId = params.id;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Extraer solo campos permitidos
    const {
      clientId, providerId, originCurrencyId, destCurrencyId,
      originAmount, destAmount, exchangeRate, operationDate,
      observations, adminPassword,
    } = body;

    // Validar campos requeridos
    if (!clientId || !providerId || !originCurrencyId || !destCurrencyId ||
        originAmount === undefined || destAmount === undefined ||
        exchangeRate === undefined || !operationDate) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const parsedOriginAmount = parseFloat(originAmount);
    const parsedDestAmount = parseFloat(destAmount);
    const parsedExchangeRate = parseFloat(exchangeRate);
    const parsedDate = new Date(operationDate);

    if (isNaN(parsedOriginAmount) || parsedOriginAmount <= 0 ||
        isNaN(parsedDestAmount) || parsedDestAmount <= 0 ||
        isNaN(parsedExchangeRate) || parsedExchangeRate <= 0 ||
        isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Datos numéricos o de fecha inválidos" }, { status: 400 });
    }

    const oldOperation = await prisma.operation.findFirst({
      where: { id: operationId, deletedAt: null },
    });

    if (!oldOperation) {
      return NextResponse.json({ error: "Operación no encontrada" }, { status: 404 });
    }
    if (oldOperation.type.startsWith("DISTRIBUTED_SALE") || oldOperation.type === "SINGLE_SALE") {
      return NextResponse.json({ error: "Editá la venta distribuida desde su formulario para actualizar pagos y saldos juntos" }, { status: 400 });
    }

    // Validar Bloqueo Contable
    const settings = await prisma.settings.findFirst();
    if (settings?.accountingBlockDate) {
      if (parsedDate < settings.accountingBlockDate || oldOperation.operationDate < settings.accountingBlockDate) {
        const blockDateStr = new Date(settings.accountingBlockDate).toLocaleDateString("es-AR");
        return NextResponse.json(
          { error: `No se pueden modificar operaciones anteriores a la fecha de bloqueo contable (${blockDateStr}).` },
          { status: 400 }
        );
      }
    }

    // Solo el administrador puede modificar operaciones completadas
    if (oldOperation.state === "COMPLETED" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo el administrador puede modificar operaciones completadas" },
        { status: 403 }
      );
    }

    const updatedOperation = await prisma.operation.update({
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

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Operation",
      entityId: operationId,
      oldValues: { state: oldOperation.state, originAmount: oldOperation.originAmount },
      newValues: { originAmount: updatedOperation.originAmount, destAmount: updatedOperation.destAmount },
    });

    return NextResponse.json(updatedOperation, { status: 200 });
  } catch (error: any) {
    console.error("Operation PUT error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}

class PatchError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
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
  const applyTransaction = async (contactId: string, currencyId: string, amount: number, concept: string) => {
    const account = await tx.account.upsert({
      where: { contactId_currencyId: { contactId, currencyId } },
      create: { contactId, currencyId, balance: amount },
      update: { balance: { increment: amount } },
    });
    await tx.transaction.create({
      data: {
        accountId: account.id,
        concept: concept.substring(0, 500),
        credit: amount > 0 ? amount : 0,
        debit: amount < 0 ? Math.abs(amount) : 0,
        balance: account.balance,
        operationId: id,
      },
    });
  };

  const applyTreasuryAndSettle = async (contactId: string, currencyId: string, amount: number, conceptSettlement: string, conceptTreasury: string) => {
    await applyTransaction(contactId, currencyId, -amount, conceptSettlement);

    let tAccount = await tx.treasuryAccount.findFirst({ where: { currencyId, type: "CASH" } });
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
        type: amount > 0 ? "INCOME" : "EXPENSE",
        amount: Math.abs(amount),
        concept: conceptTreasury,
      },
    });
  };

  // 1. Deuda Comercial
  if (clientId) {
    await applyTransaction(clientId, originCurrencyId, originAmount, `Operación ${operationNumber} - Entrega Origen`);
    await applyTransaction(clientId, destCurrencyId, -destAmount, `Operación ${operationNumber} - Recepción Destino`);
  }
  if (providerId) {
    await applyTransaction(providerId, originCurrencyId, -originAmount, `Operación ${operationNumber} - Recepción Origen`);
    await applyTransaction(providerId, destCurrencyId, destAmount, `Operación ${operationNumber} - Entrega Destino`);
  }

  // 2. Liquidación y Tesorería
  if (!withPayment) return;
  if (clientId) {
    await applyTreasuryAndSettle(clientId, originCurrencyId, originAmount, `Cobro/Pago Op. ${operationNumber} - Origen`, `Ingreso por Op. ${operationNumber} (Cliente)`);
    await applyTreasuryAndSettle(clientId, destCurrencyId, -destAmount, `Cobro/Pago Op. ${operationNumber} - Destino`, `Egreso por Op. ${operationNumber} (Cliente)`);
  }
  if (providerId) {
    await applyTreasuryAndSettle(providerId, originCurrencyId, -originAmount, `Cobro/Pago Op. ${operationNumber} - Origen`, `Egreso por Op. ${operationNumber} (Proveedor)`);
    await applyTreasuryAndSettle(providerId, destCurrencyId, destAmount, `Cobro/Pago Op. ${operationNumber} - Destino`, `Ingreso por Op. ${operationNumber} (Proveedor)`);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const operationId = params.id;
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
    const { oldOperation, updatedOperation } = await prisma.$transaction(async (tx) => {
      // Bloquear la fila serializa pedidos concurrentes (doble clic, dos pestañas):
      // el segundo espera y lee el estado ya actualizado, así no se contabiliza dos veces.
      await tx.$queryRaw`SELECT id FROM "Operation" WHERE id = ${operationId} FOR UPDATE`;
      const oldOperation = await tx.operation.findFirst({
        where: { id: operationId, deletedAt: null },
      });

      if (!oldOperation) {
        throw new PatchError("Operación no encontrada", 404);
      }
      if (oldOperation.type.startsWith("DISTRIBUTED_SALE") || oldOperation.type === "SINGLE_SALE") {
        throw new PatchError("Actualizá los cobros y el pago al proveedor desde Editar venta distribuida", 400);
      }
      if (oldOperation.state === "COMPLETED" && state && state !== "COMPLETED" && user.role !== "ADMIN") {
        throw new PatchError("Solo el administrador puede modificar operaciones completadas", 403);
      }

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

      return { oldOperation, updatedOperation };
    }, { maxWait: 10000, timeout: 20000 });

    await logAudit({
      userId: user.id,
      action: "UPDATE_STATE_OR_PAY",
      entity: "Operation",
      entityId: operationId,
      oldValues: { state: oldOperation.state, isPaid: oldOperation.isPaid },
      newValues: { state: updatedOperation.state, isPaid: updatedOperation.isPaid },
    });

    return NextResponse.json(updatedOperation, { status: 200 });
  } catch (error: any) {
    if (error instanceof PatchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Operation PATCH error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const operationId = params.id;

    const op = await prisma.operation.findFirst({
      where: { id: operationId, deletedAt: null },
      include: {
        childOperations: true,
      },
    });

    if (!op) {
      return NextResponse.json({ error: "Operación no encontrada" }, { status: 404 });
    }

    const now = new Date();

    await prisma.$transaction(
      async (tx) => {
        const opsToDelete = [op, ...(op.childOperations || [])];

        for (const currentOp of opsToDelete) {
          // 1. Desvincular o buscar transacciones asociadas a la operación
          const txs = await tx.transaction.findMany({
            where: { operationId: currentOp.id },
            include: { account: true },
          });

          // 2. Revertir impacto en cuentas corrientes y eliminar transacciones
          for (const transaction of txs) {
            const account = transaction.account;
            if (!account) continue;

            const adjustment = transaction.debit - transaction.credit;

            await tx.account.update({
              where: { id: account.id },
              data: { balance: { increment: adjustment } },
            });
          }
          await tx.transaction.deleteMany({ where: { operationId: currentOp.id } });

          // 2.5 Revertir impacto en Cajas (Tesorería) y eliminar movimientos
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

          // 3. Eliminar o desvincular relaciones secundarias para evitar FK constraints
          await tx.settlement.deleteMany({ where: { operationId: currentOp.id } });
          await tx.attachment.deleteMany({ where: { operationId: currentOp.id } });
          await tx.internalComment.deleteMany({ where: { operationId: currentOp.id } });
          await tx.operationStateHistory.deleteMany({ where: { operationId: currentOp.id } });

          // 4. Soft delete de la operación
          await tx.operation.update({
            where: { id: currentOp.id },
            data: { deletedAt: now, state: "CANCELED" },
          });
        }
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    await logAudit({
      userId: user.id,
      action: "DELETE",
      entity: "Operation",
      entityId: operationId,
      oldValues: { operationNumber: op.operationNumber, state: op.state },
    });

    return NextResponse.json({ success: true, message: "Operación eliminada y saldos ajustados" }, { status: 200 });
  } catch (error: any) {
    console.error("Operation DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Error al eliminar la operación" }, { status: 500 });
  }
}
