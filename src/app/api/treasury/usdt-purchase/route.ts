import { monetaryJson, positiveDecimal } from "@/lib/monetary";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { TreasuryError } from "@/lib/manual-treasury";
import { nextOperationNumber } from "@/lib/distributed-sale";
import { can } from "@/lib/permissions";
import { AccountingPeriodError, assertOpenAccountingPeriod, lockAccountingWrites } from "@/lib/accounting-period";
import { dateOnlyRange } from "@/lib/agency-time";

export const dynamic = "force-dynamic";

// Compra de USDT: sale plata de una caja (en la moneda que sea) y entra a la caja de USDT.
// Se modela igual que un traspaso entre cajas, pero con su propio tipo para no
// mezclarlo con traspasos comunes al calcular el promedio del día.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!can(user, "treasury.write"))
      return NextResponse.json({ error: "No tenés permiso para registrar compras de USDT." }, { status: 403 });

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
    const originAmount = positiveDecimal(input.originAmount);
    const usdtAmount = positiveDecimal(input.usdtAmount);
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";

    if (!originAccountId) throw new TreasuryError("Seleccioná con qué caja pagás.");
    if (!originAmount) throw new TreasuryError("El importe pagado debe ser mayor a cero.");
    if (!usdtAmount) throw new TreasuryError("La cantidad de USDT recibida debe ser mayor a cero.");

    const result = await prisma.$transaction(async (tx) => {
      await lockAccountingWrites(tx);
      const now = new Date();
      await assertOpenAccountingPeriod(tx, dateOnlyRange("today", now).gte);

      const originAcc = await tx.treasuryAccount.findUnique({ where: { id: originAccountId }, include: { currency: true } });
      if (!originAcc || !originAcc.isActive || !originAcc.currency.isActive) {
        throw new TreasuryError("La caja de pago ya no está disponible.");
      }
      const destAcc = await tx.treasuryAccount.findFirst({
        where: { isActive: true, currency: { code: "USDT", isActive: true } },
        include: { currency: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (!destAcc) throw new TreasuryError("No hay una caja de USDT activa.");
      if (originAcc.id === destAcc.id) throw new TreasuryError("Elegí una caja de pago distinta a la de USDT.");

      if (originAmount.decimalPlaces() > originAcc.currency.decimals || usdtAmount.decimalPlaces() > destAcc.currency.decimals) {
        throw new TreasuryError("Cada importe debe respetar los decimales de su moneda.");
      }

      const rate = positiveDecimal(originAmount.div(usdtAmount).toDecimalPlaces(8).toString());
      if (!rate) throw new TreasuryError("No se pudo calcular la cotización de esta compra.");

      const updatedOriginCount = await tx.treasuryAccount.updateMany({
        where: { id: originAccountId, isActive: true, balance: { gte: originAmount } },
        data: { balance: { decrement: originAmount } },
      });
      if (updatedOriginCount.count !== 1) {
        throw new TreasuryError("La caja de pago no tiene saldo suficiente para esta compra.", 409);
      }
      await tx.treasuryAccount.update({ where: { id: destAcc.id }, data: { balance: { increment: usdtAmount } } });

      const originConcept = `Compra de USDT (${usdtAmount.toNumber().toLocaleString("es-AR")} USDT @ ${rate})`;
      const destConcept = `Compra de USDT desde ${originAcc.name} (${originAmount.toNumber().toLocaleString("es-AR")} ${originAcc.currency.code} @ ${rate})`;

      const opNumber = await nextOperationNumber(tx);
      const operation = await tx.operation.create({
        data: {
          operationNumber: opNumber,
          type: "USDT_PURCHASE",
          originCurrencyId: originAcc.currencyId,
          destCurrencyId: destAcc.currencyId,
          originAmount,
          destAmount: usdtAmount,
          exchangeRate: rate,
          operationDate: now,
          isPaid: true,
          providerIsPaid: true,
          state: "COMPLETED",
          observations: reason || originConcept,
        },
      });

      const originMovement = await tx.treasuryMovement.create({
        data: { treasuryAccountId: originAccountId, operationId: operation.id, type: "EXPENSE", amount: originAmount, concept: originConcept, observations: reason || undefined },
        include: { account: { include: { currency: true } }, operation: { select: { operationNumber: true } } },
      });
      const destMovement = await tx.treasuryMovement.create({
        data: { treasuryAccountId: destAcc.id, operationId: operation.id, type: "INCOME", amount: usdtAmount, concept: destConcept, observations: reason || undefined },
        include: { account: { include: { currency: true } }, operation: { select: { operationNumber: true } } },
      });

      const [updatedOriginAcc, updatedDestAcc] = await Promise.all([
        tx.treasuryAccount.findUniqueOrThrow({ where: { id: originAccountId }, include: { currency: true } }),
        tx.treasuryAccount.findUniqueOrThrow({ where: { id: destAcc.id }, include: { currency: true } }),
      ]);

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          entity: "UsdtPurchase",
          entityId: operation.id,
          newValues: JSON.stringify(monetaryJson({ originAccountId, originAmount, usdtAmount, rate, reason,
            originBalanceAfter: updatedOriginAcc.balance, destBalanceAfter: updatedDestAcc.balance })),
        },
      });

      return { originAccount: updatedOriginAcc, destAccount: updatedDestAcc, originMovement, destMovement };
    });

    return NextResponse.json(monetaryJson(result), { status: 201 });
  } catch (error) {
    if (error instanceof AccountingPeriodError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof TreasuryError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("USDT purchase error:", error);
    return NextResponse.json({ error: "No se pudo registrar la compra de USDT." }, { status: 500 });
  }
}
