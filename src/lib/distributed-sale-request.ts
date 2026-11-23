import { monetaryJson, positiveDecimal } from "@/lib/monetary";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { AccountingPeriodError } from "@/lib/accounting-period";
import { can } from "@/lib/permissions";
import { saveDistributedSale, SaleInput, SaleItem, SaleValidationError } from "@/lib/distributed-sale";

export async function handleDistributedSale(req: NextRequest, parentId?: string) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!can(user, "operations.write")) return NextResponse.json({ error: "Tu rol no puede registrar ni modificar ventas" }, { status: 403 });
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const { providerId, currencyId, operationDate, observations, items } = body;
    const operationType = body.operationType ?? "DISTRIBUTED_SALE";
    if (operationType !== "DISTRIBUTED_SALE" && operationType !== "SINGLE_SALE")
      return NextResponse.json({ error: "Tipo de operación inválido" }, { status: 400 });
    if (operationType === "SINGLE_SALE" && (!Array.isArray(items) || items.length !== 1))
      return NextResponse.json({ error: "La operación 1 a 1 debe tener exactamente un movimiento de cliente." }, { status: 400 });
    const date = new Date(operationDate);
    if (typeof providerId !== "string" || !providerId || typeof currencyId !== "string" || !currencyId ||
      !operationDate || !Number.isFinite(date.getTime())) {
      return NextResponse.json({ error: "Complete proveedor, moneda y fecha válida" }, { status: 400 });
    }
    if (!Array.isArray(items) || !items.length || items.length > 500) {
      return NextResponse.json({ error: "Debe ingresar entre 1 y 500 líneas de cliente" }, { status: 400 });
    }
    const normalized: SaleItem[] = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const amount = positiveDecimal(item?.amount);
      const providerRate = positiveDecimal(item?.providerExchangeRate);
      const clientRate = positiveDecimal(item?.exchangeRate);
      if (typeof item?.clientId !== "string" || !item.clientId || typeof item?.destCurrencyId !== "string" || !item.destCurrencyId ||
        !amount || !providerRate || !clientRate || amount.times(providerRate).gte(1e22) || typeof item.isPaid !== "boolean") {
        return NextResponse.json({ error: `Cliente, monto, moneda o cotizaciones inválidos en la línea #${index + 1}` }, { status: 400 });
      }
      if (clientRate.gte(providerRate)) {
        return NextResponse.json({ error: `La cotización del cliente tiene que ser menor a la del proveedor en la línea #${index + 1}` }, { status: 400 });
      }
      normalized.push({ clientId: item.clientId, amount, destCurrencyId: item.destCurrencyId, providerExchangeRate: providerRate, exchangeRate: clientRate,
        observations: item.observations ? String(item.observations).slice(0, 2000) : null, isPaid: !!item.isPaid });
    }
    const total = normalized.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
    if (total.gte(1e22)) {
      return NextResponse.json({ error: "El total de la operación supera el límite numérico" }, { status: 400 });
    }

    const ids = Array.from(new Set([providerId, ...normalized.map(i => i.clientId)]));
    const currencyIdsToFetch = Array.from(new Set([currencyId, ...normalized.map(i => i.destCurrencyId)]));
    const [contacts, currencies] = await Promise.all([
      prisma.contact.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } }),
      prisma.currency.findMany({ where: { id: { in: currencyIdsToFetch }, isActive: true }, select: { id: true } }),
    ]);
    if (contacts.length !== ids.length) {
      return NextResponse.json({ error: "Proveedor o clientes no encontrados" }, { status: 400 });
    }
    if (!currencies.some(c => c.id === currencyId)) {
      return NextResponse.json({ error: "La moneda del monto transferido no existe o está inactiva" }, { status: 400 });
    }
    if (normalized.some(item => !currencies.some(c => c.id === item.destCurrencyId))) {
      return NextResponse.json({ error: "Alguna de las monedas de cliente no existe o está inactiva" }, { status: 400 });
    }
    const input: SaleInput = { providerId, currencyId, operationDate: date,
      observations: observations ? String(observations).slice(0, 2000) : null, items: normalized, operationType };
    const result = await prisma.$transaction(async tx => {
      const result = await saveDistributedSale(tx, input, parentId, can(user, "operations.reopen"));
      await tx.auditLog.create({ data: { userId: user.id, action: parentId ? "UPDATE" : "CREATE", entity: "Operation",
        entityId: result.parentOp.id, newValues: JSON.stringify({ operationNumber: result.parentOp.operationNumber,
          type: result.parentOp.type, totalAmount: result.parentOp.originAmount.toNumber(), itemCount: normalized.length,
          clientPayments: normalized.map(item => ({ clientId: item.clientId, isPaid: item.isPaid })), state: result.parentOp.state }) } });
      return result;
    }, { maxWait: 10000, timeout: 30000 });
    return NextResponse.json(monetaryJson(result), { status: parentId ? 200 : 201 });
  } catch (error) {
    if (error instanceof AccountingPeriodError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof SaleValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Distributed sale save error:", error);
    const notFound = error instanceof Error && error.message === "Operación distribuida no encontrada";
    return NextResponse.json({ error: notFound ? error.message : "Error al guardar la operación distribuida" }, { status: notFound ? 404 : 500 });
  }
}
