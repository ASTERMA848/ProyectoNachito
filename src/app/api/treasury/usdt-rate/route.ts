import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { Prisma } from "@prisma/client";
import { instantRange } from "@/lib/agency-time";

export const dynamic = "force-dynamic";

// Promedio ponderado del día (plata pagada / USDT recibidos), por moneda de pago,
// sobre las compras de USDT registradas hoy. Lo usa la venta para la "ganancia real".
export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const usdtCurrency = await prisma.currency.findUnique({ where: { code: "USDT" }, select: { id: true } });
    if (!usdtCurrency) return NextResponse.json({ usdtCurrencyId: null, rates: {} });

    const range = instantRange("today");
    const purchases = await prisma.operation.findMany({
      where: { type: "USDT_PURCHASE", deletedAt: null, destCurrencyId: usdtCurrency.id, operationDate: { gte: range.gte, lt: range.lt } },
      select: { originCurrencyId: true, originAmount: true, destAmount: true },
    });

    const totals = new Map<string, { paid: Prisma.Decimal; usdt: Prisma.Decimal }>();
    for (const purchase of purchases) {
      const current = totals.get(purchase.originCurrencyId) ?? { paid: new Prisma.Decimal(0), usdt: new Prisma.Decimal(0) };
      current.paid = current.paid.plus(purchase.originAmount);
      current.usdt = current.usdt.plus(purchase.destAmount);
      totals.set(purchase.originCurrencyId, current);
    }

    const rates: Record<string, number> = {};
    for (const [currencyId, { paid, usdt }] of totals) {
      if (usdt.greaterThan(0)) rates[currencyId] = paid.div(usdt).toNumber();
    }

    return NextResponse.json({ usdtCurrencyId: usdtCurrency.id, rates });
  } catch (error) {
    console.error("USDT rate error:", error);
    return NextResponse.json({ error: "No se pudo calcular el promedio de USDT del día." }, { status: 500 });
  }
}
