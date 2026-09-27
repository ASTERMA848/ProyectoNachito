import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({
      include: {
        contact: true,
        currency: true,
      },
      orderBy: [
        { contact: { name: "asc" } },
        { currency: { code: "asc" } },
      ],
    });
    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error: any) {
    console.error("Accounts GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

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

    // Extraer solo campos esperados
    const { contactId, currencyId, type, amount, concept, observations } = body;

    if (!contactId || !currencyId || !type || amount === undefined || !concept) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Validar tipos
    if (
      typeof contactId !== "string" ||
      typeof currencyId !== "string" ||
      typeof concept !== "string"
    ) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Validar tipo de movimiento
    if (type !== "DEBIT" && type !== "CREDIT") {
      return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 });
    }

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      return NextResponse.json({ error: "El monto debe ser un número positivo" }, { status: 400 });
    }

    if (concept.trim().length === 0 || concept.length > 500) {
      return NextResponse.json({ error: "El concepto es inválido" }, { status: 400 });
    }

    const debit = type === "DEBIT" ? val : 0;
    const credit = type === "CREDIT" ? val : 0;

    // Verificar que el contacto existe
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, deletedAt: null },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    // Verificar que la moneda existe
    const currency = await prisma.currency.findFirst({
      where: { id: currencyId, isActive: true },
    });
    if (!currency) {
      return NextResponse.json({ error: "Moneda no encontrada" }, { status: 404 });
    }

    // Buscar o crear la cuenta
    let account = await prisma.account.findUnique({
      where: { contactId_currencyId: { contactId, currencyId } },
    });

    if (!account) {
      account = await prisma.account.create({
        data: { contactId, currencyId, balance: 0 },
      });
    }

    const newBalance = account.balance + debit - credit;

    const [, newTransaction] = await prisma.$transaction([
      prisma.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      }),
      prisma.transaction.create({
        data: {
          accountId: account.id,
          concept: concept.trim().substring(0, 500),
          debit,
          credit,
          balance: newBalance,
          observations: observations
            ? String(observations).trim().substring(0, 2000)
            : null,
        },
      }),
    ]);

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entity: "Transaction",
      entityId: newTransaction.id,
      newValues: { accountId: account.id, debit, credit, balance: newBalance },
    });

    return NextResponse.json({ account: { ...account, balance: newBalance } }, { status: 201 });
  } catch (error: any) {
    console.error("Accounts POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
