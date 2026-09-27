import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/treasury/transfer — Transferencia interna entre cuentas de tesorería
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

    const { fromAccountId, toAccountId, amount, concept, reference, date } = body;

    if (!fromAccountId || !toAccountId) {
      return NextResponse.json({ error: "Debe seleccionar cuenta de origen y cuenta de destino" }, { status: 400 });
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json({ error: "La cuenta de origen y destino no pueden ser la misma" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "El monto a transferir debe ser un número positivo" }, { status: 400 });
    }

    const transferDate = date ? new Date(date) : new Date();
    if (isNaN(transferDate.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const baseConcept = concept && typeof concept === "string" && concept.trim().length > 0
      ? concept.trim()
      : "Transferencia interna de fondos";

    // Validar cuentas
    const [fromAccount, toAccount] = await Promise.all([
      prisma.treasuryAccount.findUnique({
        where: { id: fromAccountId },
        include: { currency: true },
      }),
      prisma.treasuryAccount.findUnique({
        where: { id: toAccountId },
        include: { currency: true },
      }),
    ]);

    if (!fromAccount || !toAccount) {
      return NextResponse.json({ error: "Una de las cuentas seleccionadas no existe" }, { status: 404 });
    }

    if (!fromAccount.isActive || !toAccount.isActive) {
      return NextResponse.json({ error: "Una de las cuentas está inactiva" }, { status: 400 });
    }

    if (fromAccount.currencyId !== toAccount.currencyId) {
      return NextResponse.json(
        {
          error: `Las transferencias directas de tesorería deben ser en la misma moneda (${fromAccount.currency.code} vs ${toAccount.currency.code}). Para cambio de divisas utilice el módulo de Operaciones.`,
        },
        { status: 400 }
      );
    }

    // Ejecutar transferencia atómica
    const result = await prisma.$transaction(async (tx) => {
      // 1. Descontar de cuenta origen
      const newFromBalance = fromAccount.balance - parsedAmount;
      await tx.treasuryAccount.update({
        where: { id: fromAccountId },
        data: { balance: newFromBalance },
      });

      // Movimiento de salida
      const outMovement = await tx.treasuryMovement.create({
        data: {
          accountId: fromAccountId,
          type: "TRANSFER",
          amount: parsedAmount,
          concept: `Salida hacia ${toAccount.name} (${baseConcept})`,
          reference: reference ? String(reference).trim() : null,
          date: transferDate,
        },
      });

      // 2. Acreditar en cuenta destino
      const newToBalance = toAccount.balance + parsedAmount;
      await tx.treasuryAccount.update({
        where: { id: toAccountId },
        data: { balance: newToBalance },
      });

      // Movimiento de entrada
      const inMovement = await tx.treasuryMovement.create({
        data: {
          accountId: toAccountId,
          type: "TRANSFER",
          amount: parsedAmount,
          concept: `Entrada desde ${fromAccount.name} (${baseConcept})`,
          reference: reference ? String(reference).trim() : null,
          date: transferDate,
        },
      });

      return {
        outMovement,
        inMovement,
        fromBalance: newFromBalance,
        toBalance: newToBalance,
      };
    });

    await logAudit({
      userId: user.id,
      action: "TRANSFER",
      entity: "TreasuryAccount",
      entityId: fromAccountId,
      newValues: {
        fromAccountId,
        toAccountId,
        amount: parsedAmount,
        currency: fromAccount.currency.code,
        concept: baseConcept,
      },
    });

    return NextResponse.json({ success: true, transfer: result }, { status: 201 });
  } catch (error: any) {
    console.error("Treasury transfer POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
