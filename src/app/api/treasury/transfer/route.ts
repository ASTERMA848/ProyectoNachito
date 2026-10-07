import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { TreasuryError } from "@/lib/manual-treasury";
import { nextOperationNumber } from "@/lib/distributed-sale";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "ADMIN" && user.role !== "OPERATOR")
      return NextResponse.json({ error: "No tenés permiso para registrar traspasos." }, { status: 403 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Los datos de la solicitud no son válidos." }, { status: 400 });
    }

    const input = body as Record<string, unknown> | null;
    if (!input || typeof input !== "object") {
      throw new TreasuryError("Datos no válidos.");
    }

    const originAccountId = typeof input.originAccountId === "string" ? input.originAccountId.trim() : "";
    const destAccountId = typeof input.destAccountId === "string" ? input.destAccountId.trim() : "";
    const originAmount = typeof input.originAmount === "number" ? input.originAmount : Number(input.originAmount);
    const destAmount = typeof input.destAmount === "number" ? input.destAmount : Number(input.destAmount);
    const exchangeRate = input.exchangeRate ? Number(input.exchangeRate) : undefined;
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";

    if (!originAccountId) {
      throw new TreasuryError("Seleccioná la caja de origen.");
    }
    if (!destAccountId) {
      throw new TreasuryError("Seleccioná la caja de destino.");
    }
    if (originAccountId === destAccountId) {
      throw new TreasuryError("La caja de origen y la caja de destino deben ser distintas.");
    }
    if (!Number.isFinite(originAmount) || originAmount <= 0) {
      throw new TreasuryError("El monto a debitar de la caja origen debe ser mayor a cero.");
    }
    if (!Number.isFinite(destAmount) || destAmount <= 0) {
      throw new TreasuryError("El monto a acreditar en la caja destino debe ser mayor a cero.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const originAcc = await tx.treasuryAccount.findUnique({
        where: { id: originAccountId },
        include: { currency: true },
      });
      const destAcc = await tx.treasuryAccount.findUnique({
        where: { id: destAccountId },
        include: { currency: true },
      });

      if (!originAcc || !originAcc.isActive || !originAcc.currency.isActive) {
        throw new TreasuryError("La caja de origen ya no está disponible.");
      }
      if (!destAcc || !destAcc.isActive || !destAcc.currency.isActive) {
        throw new TreasuryError("La caja de destino ya no está disponible.");
      }

      // Decrement origin balance
      const updatedOriginCount = await tx.treasuryAccount.updateMany({
        where: { id: originAccountId, isActive: true },
        data: { balance: { decrement: originAmount } },
      });
      if (updatedOriginCount.count !== 1) {
        throw new TreasuryError("No se pudo actualizar el saldo de la caja de origen.");
      }

      // Increment dest balance
      const updatedDestCount = await tx.treasuryAccount.updateMany({
        where: { id: destAccountId, isActive: true },
        data: { balance: { increment: destAmount } },
      });
      if (updatedDestCount.count !== 1) {
        throw new TreasuryError("No se pudo actualizar el saldo de la caja de destino.");
      }

      const updatedOriginAcc = await tx.treasuryAccount.findUniqueOrThrow({
        where: { id: originAccountId },
        include: { currency: true },
      });
      const updatedDestAcc = await tx.treasuryAccount.findUniqueOrThrow({
        where: { id: destAccountId },
        include: { currency: true },
      });

      const isCrossCurrency = originAcc.currencyId !== destAcc.currencyId;
      const rateStr = isCrossCurrency && exchangeRate ? ` @ ${exchangeRate}` : "";

      const originConcept = `Traspaso a ${destAcc.name} (${destAmount.toLocaleString("es-AR")} ${destAcc.currency.code}${rateStr})`;
      const destConcept = `Traspaso desde ${originAcc.name} (${originAmount.toLocaleString("es-AR")} ${originAcc.currency.code}${rateStr})`;

      const opNumber = await nextOperationNumber(tx as any);

      const operation = await tx.operation.create({
        data: {
          operationNumber: opNumber,
          type: "TREASURY_TRANSFER",
          originCurrencyId: originAcc.currencyId,
          destCurrencyId: destAcc.currencyId,
          originAmount: originAmount,
          destAmount: destAmount,
          exchangeRate: exchangeRate || 1,
          operationDate: new Date(),
          isPaid: true,
          providerIsPaid: true,
          state: "COMPLETED",
          observations: reason || originConcept,
        },
      });

      const originMovement = await tx.treasuryMovement.create({
        data: {
          treasuryAccountId: originAccountId,
          operationId: operation.id,
          type: "EXPENSE",
          amount: originAmount,
          concept: originConcept,
          observations: reason || undefined,
        },
        include: { account: { include: { currency: true } }, operation: { select: { operationNumber: true } } },
      });

      const destMovement = await tx.treasuryMovement.create({
        data: {
          treasuryAccountId: destAccountId,
          operationId: operation.id,
          type: "INCOME",
          amount: destAmount,
          concept: destConcept,
          observations: reason || undefined,
        },
        include: { account: { include: { currency: true } }, operation: { select: { operationNumber: true } } },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          entity: "TreasuryTransfer",
          newValues: JSON.stringify({
            originAccountId,
            destAccountId,
            originAmount,
            destAmount,
            exchangeRate,
            reason,
            originBalanceAfter: updatedOriginAcc.balance,
            destBalanceAfter: updatedDestAcc.balance,
          }),
        },
      });

      return {
        originAccount: updatedOriginAcc,
        destAccount: updatedDestAcc,
        originMovement,
        destMovement,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TreasuryError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Treasury transfer error:", error);
    return NextResponse.json({ error: "No se pudo registrar la transferencia entre cajas." }, { status: 500 });
  }
}

