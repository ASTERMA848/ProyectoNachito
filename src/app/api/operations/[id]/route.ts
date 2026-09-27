import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { verifyPassword } from "@/lib/auth-utils";
import { logAudit } from "@/lib/audit";

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

    // Verificar contraseña admin para modificar operaciones completadas
    if (oldOperation.state === "COMPLETED") {
      if (user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Solo el administrador puede modificar operaciones completadas" },
          { status: 403 }
        );
      }
      const authorized = await verifyAdminPassword(user.id, adminPassword);
      if (!authorized) {
        return NextResponse.json(
          { error: "Contraseña de administrador incorrecta" },
          { status: 401 }
        );
      }
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

    const { state, adminPassword } = body;

    // Validar estado contra lista de valores permitidos (nunca confiar en el cliente)
    if (!state || !VALID_STATES.includes(state)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATES.join(", ")}` },
        { status: 400 }
      );
    }

    const oldOperation = await prisma.operation.findFirst({
      where: { id: operationId, deletedAt: null },
    });

    if (!oldOperation) {
      return NextResponse.json({ error: "Operación no encontrada" }, { status: 404 });
    }

    // Modificar operaciones completadas requiere ser ADMIN + contraseña
    if (oldOperation.state === "COMPLETED") {
      if (user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Solo el administrador puede modificar operaciones completadas" },
          { status: 403 }
        );
      }
      const authorized = await verifyAdminPassword(user.id, adminPassword);
      if (!authorized) {
        return NextResponse.json(
          { error: "Contraseña de administrador incorrecta" },
          { status: 401 }
        );
      }
    }

    const updatedOperation = await prisma.operation.update({
      where: { id: operationId },
      data: { state },
      include: {
        client: true,
        provider: true,
        originCurrency: true,
        destCurrency: true,
      },
    });

    // Lógica contable automática al completar una operación
    if (state === "COMPLETED" && oldOperation.state !== "COMPLETED") {
      const { clientId, providerId, originCurrencyId, destCurrencyId, originAmount, destAmount, operationNumber } = updatedOperation;

      const applyTransaction = async (
        contactId: string,
        currencyId: string,
        amount: number,
        concept: string
      ) => {
        let account = await prisma.account.findUnique({
          where: { contactId_currencyId: { contactId, currencyId } },
        });
        if (!account) {
          account = await prisma.account.create({
            data: { contactId, currencyId, balance: 0 },
          });
        }
        const isCredit = amount > 0;
        const newBalance = account.balance + amount;
        await prisma.$transaction([
          prisma.account.update({
            where: { id: account.id },
            data: { balance: newBalance },
          }),
          prisma.transaction.create({
            data: {
              accountId: account.id,
              concept: concept.substring(0, 500),
              credit: isCredit ? amount : 0,
              debit: !isCredit ? Math.abs(amount) : 0,
              balance: newBalance,
            },
          }),
        ]);
      };

      await applyTransaction(clientId, originCurrencyId, originAmount, `Operación ${operationNumber} - Entrega Origen`);
      await applyTransaction(clientId, destCurrencyId, -destAmount, `Operación ${operationNumber} - Recepción Destino`);
      await applyTransaction(providerId, originCurrencyId, -originAmount, `Operación ${operationNumber} - Recepción Origen`);
      await applyTransaction(providerId, destCurrencyId, destAmount, `Operación ${operationNumber} - Entrega Destino`);
    }

    await logAudit({
      userId: user.id,
      action: "UPDATE_STATE",
      entity: "Operation",
      entityId: operationId,
      oldValues: { state: oldOperation.state },
      newValues: { state: updatedOperation.state },
    });

    return NextResponse.json(updatedOperation, { status: 200 });
  } catch (error: any) {
    console.error("Operation PATCH error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
