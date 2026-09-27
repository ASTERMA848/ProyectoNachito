import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/treasury/accounts — Listar todas las cajas y cuentas bancarias/cripto
export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const accounts = await prisma.treasuryAccount.findMany({
      include: {
        currency: true,
        _count: {
          select: { movements: true },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { type: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error: any) {
    console.error("Treasury accounts GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

// POST /api/treasury/accounts — Crear nueva cuenta de tesorería
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

    const { name, type, currencyId, initialBalance } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const validTypes = ["CASH", "BANK", "WALLET"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo de cuenta inválido (CASH, BANK, WALLET)" }, { status: 400 });
    }

    if (!currencyId || typeof currencyId !== "string") {
      return NextResponse.json({ error: "Moneda requerida" }, { status: 400 });
    }

    // Verificar moneda
    const currency = await prisma.currency.findUnique({
      where: { id: currencyId },
    });
    if (!currency) {
      return NextResponse.json({ error: "Moneda no encontrada" }, { status: 404 });
    }

    const parsedInitial = initialBalance !== undefined ? parseFloat(initialBalance) : 0;
    const safeInitial = isNaN(parsedInitial) ? 0 : parsedInitial;

    const newAccount = await prisma.$transaction(async (tx) => {
      const acc = await tx.treasuryAccount.create({
        data: {
          name: name.trim().substring(0, 100),
          type,
          currencyId,
          balance: safeInitial,
          isActive: true,
        },
        include: { currency: true },
      });

      if (safeInitial !== 0) {
        await tx.treasuryMovement.create({
          data: {
            accountId: acc.id,
            type: "ADJUSTMENT",
            amount: safeInitial,
            concept: "Saldo inicial de apertura de cuenta",
            reference: "APERTURA",
          },
        });
      }

      return acc;
    });

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entity: "TreasuryAccount",
      entityId: newAccount.id,
      newValues: { name: newAccount.name, type: newAccount.type, balance: newAccount.balance },
    });

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error: any) {
    console.error("Treasury account POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
