import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { saveDistributedSale, SaleInput, SaleItem } from "@/lib/distributed-sale";

export async function handleDistributedSale(req: NextRequest, parentId?: string) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const { providerId, currencyId, exchangeRate, operationDate, observations, items, providerIsPaid } = body;
    if (typeof providerIsPaid !== "boolean") {
      return NextResponse.json({ error: "Indicá si el proveedor está pagado o pendiente" }, { status: 400 });
    }
    const rate = Number(exchangeRate);
    const date = new Date(operationDate);
    if (typeof providerId !== "string" || !providerId || typeof currencyId !== "string" || !currencyId ||
      !Number.isFinite(rate) || rate <= 0 || !operationDate || !Number.isFinite(date.getTime())) {
      return NextResponse.json({ error: "Complete proveedor, moneda, cotización positiva y fecha válida" }, { status: 400 });
    }
    if (!Array.isArray(items) || !items.length || items.length > 500) {
      return NextResponse.json({ error: "Debe ingresar entre 1 y 500 líneas de cliente" }, { status: 400 });
    }
    const normalized: SaleItem[] = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const amount = Number(item?.amount);
      const itemRate = item?.exchangeRate === "" || item?.exchangeRate == null ? rate : Number(item.exchangeRate);
      if (typeof item?.clientId !== "string" || !item.clientId || !Number.isFinite(amount) || amount <= 0 ||
        !Number.isFinite(itemRate) || itemRate <= 0 || !Number.isFinite(amount * itemRate) || typeof item.isPaid !== "boolean") {
        return NextResponse.json({ error: `Cliente, monto o cotización inválidos en la línea #${index + 1}` }, { status: 400 });
      }
      normalized.push({ clientId: item.clientId, amount, exchangeRate: itemRate,
        observations: item.observations ? String(item.observations).slice(0, 2000) : null, isPaid: !!item.isPaid });
    }
    if (!Number.isFinite(normalized.reduce((sum, item) => sum + item.amount, 0) * rate)) {
      return NextResponse.json({ error: "El total de la operación supera el límite numérico" }, { status: 400 });
    }
    const ids = Array.from(new Set([providerId, ...normalized.map(i => i.clientId)]));
    const [contacts, currencies, settings] = await Promise.all([
      prisma.contact.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } }),
      prisma.currency.findMany({ where: { isActive: true, OR: [{ id: currencyId }, { code: "ARS" }] }, select: { id: true, code: true } }),
      prisma.settings.findFirst({ select: { accountingBlockDate: true } }),
    ]);
    const origin = currencies.find(c => c.id === currencyId);
    const destination = currencies.find(c => c.code === "ARS");
    if (!origin || contacts.length !== ids.length) {
      return NextResponse.json({ error: "Proveedor, clientes o moneda no encontrados" }, { status: 400 });
    }
    if (!destination) return NextResponse.json({ error: "Activá la moneda ARS para registrar los cobros y pagos en pesos" }, { status: 400 });
    if (settings?.accountingBlockDate && date < settings.accountingBlockDate) {
      return NextResponse.json({ error: "La fecha es anterior al bloqueo contable" }, { status: 400 });
    }
    const input: SaleInput = { providerId, currencyId, destCurrencyId: destination.id,
      currencyCode: origin.code, exchangeRate: rate, operationDate: date,
      observations: observations ? String(observations).slice(0, 2000) : null, providerIsPaid, items: normalized };
    const result = await prisma.$transaction(async tx => {
      const result = await saveDistributedSale(tx, input, parentId);
      await tx.auditLog.create({ data: { userId: user.id, action: parentId ? "UPDATE" : "CREATE", entity: "Operation",
        entityId: result.parentOp.id, newValues: JSON.stringify({ operationNumber: result.parentOp.operationNumber,
          type: "DISTRIBUTED_SALE", totalAmount: result.parentOp.originAmount, itemCount: normalized.length,
          providerIsPaid, clientPayments: normalized.map(item => ({ clientId: item.clientId, isPaid: item.isPaid })), state: result.parentOp.state }) } });
      return result;
    }, { maxWait: 10000, timeout: 30000 });
    return NextResponse.json(result, { status: parentId ? 200 : 201 });
  } catch (error) {
    console.error("Distributed sale save error:", error);
    const notFound = error instanceof Error && error.message === "Operación distribuida no encontrada";
    return NextResponse.json({ error: notFound ? error.message : "Error al guardar la operación distribuida" }, { status: notFound ? 404 : 500 });
  }
}
