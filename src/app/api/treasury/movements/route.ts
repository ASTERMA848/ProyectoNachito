import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/treasury/movements — Listar movimientos (con filtros opcionales por cuenta y tipo)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    const where: any = {};
    if (accountId) {
      where.accountId = accountId;
    }
    if (type && ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"].includes(type)) {
      where.type = type;
    }

    const movements = await prisma.treasuryMovement.findMany({
      where,
      include: {
        account: {
          include: {
            currency: true,
          },
        },
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json({ movements }, { status: 200 });
  } catch (error: any) {
    console.error("Treasury movements GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

// POST /api/treasury/movements — Registrar un nuevo movimiento (Ingreso, Egreso, Ajuste)
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

    const { accountId, type, amount, concept, reference, date } = body;

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json({ error: "Debe seleccionar una cuenta" }, { status: 400 });
    }

    const validTypes = ["INCOME", "EXPENSE", "ADJUSTMENT"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo de movimiento inválido (INCOME, EXPENSE, ADJUSTMENT)" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "El monto debe ser un número positivo" }, { status: 400 });
    }

    if (!concept || typeof concept !== "string" || concept.trim().length === 0) {
      return NextResponse.json({ error: "El concepto es obligatorio" }, { status: 400 });
    }

    const movementDate = date ? new Date(date) : new Date();
    if (isNaN(movementDate.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    // Verificar cuenta
    const account = await prisma.treasuryAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    if (!account.isActive) {
      return NextResponse.json({ error: "La cuenta seleccionada está inactiva" }, { status: 400 });
    }

    // Calcular impacto en saldo
    // INCOME aumenta saldo (+), EXPENSE disminuye saldo (-), ADJUSTMENT puede ser positivo
    let balanceDelta = 0;
    if (type === "INCOME") {
      balanceDelta = parsedAmount;
    } else if (type === "EXPENSE") {
      balanceDelta = -parsedAmount;
    } else if (type === "ADJUSTMENT") {
      balanceDelta = parsedAmount; // Ajuste positivo
    }

    const newBalance = account.balance + balanceDelta;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el movimiento
      const movement = await tx.treasuryMovement.create({
        data: {
          accountId,
          type,
          amount: parsedAmount,
          concept: concept.trim().substring(0, 255),
          reference: reference ? String(reference).trim().substring(0, 100) : null,
          date: movementDate,
        },
        include: {
          account: {
            include: { currency: true },
          },
        },
      });

      // 2. Actualizar el saldo de la cuenta de tesorería
      await tx.treasuryAccount.update({
        where: { id: accountId },
        data: { balance: newBalance },
      });

      return movement;
    });

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entity: "TreasuryMovement",
      entityId: result.id,
      newValues: {
        accountId,
        type,
        amount: parsedAmount,
        concept,
        newAccountBalance: newBalance,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Treasury movement POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
