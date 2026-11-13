import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { can } from "@/lib/permissions";
import { nextOperationNumber } from "@/lib/distributed-sale";
import { ListError, parseListParams } from "@/lib/list-query";
import { GROUP_KEYS, listOperations, SEARCH_FIELDS, SORT_KEYS } from "@/lib/resources/operations";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

// Contrato de listas: ?q=&filter=state:pending&groupBy=state&sort=date:desc&offset=0&limit=80
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const params = parseListParams(new URL(req.url).searchParams, { sortKeys: SORT_KEYS, groupKeys: GROUP_KEYS, searchFields: SEARCH_FIELDS });
    return NextResponse.json(await listOperations(params), { status: 200 });
  } catch (error: any) {
    if (error instanceof ListError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Operations GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!can(user, "operations.write")) {
      return NextResponse.json({ error: "Tu rol no puede registrar operaciones" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Extraer solo campos permitidos (evitar mass assignment)
    const {
      clientId,
      providerId,
      originCurrencyId,
      destCurrencyId,
      originAmount,
      destAmount,
      exchangeRate,
      operationDate,
      observations,
    } = body;

    // Validar campos requeridos
    if (
      !clientId || !providerId ||
      !originCurrencyId || !destCurrencyId ||
      originAmount === undefined || destAmount === undefined ||
      exchangeRate === undefined || !operationDate
    ) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Validar tipos numéricos en backend (no confiar en el frontend)
    const parsedOriginAmount = parseFloat(originAmount);
    const parsedDestAmount = parseFloat(destAmount);
    const parsedExchangeRate = parseFloat(exchangeRate);

    if (
      isNaN(parsedOriginAmount) || parsedOriginAmount <= 0 ||
      isNaN(parsedDestAmount) || parsedDestAmount <= 0 ||
      isNaN(parsedExchangeRate) || parsedExchangeRate <= 0
    ) {
      return NextResponse.json(
        { error: "Los montos y tipo de cambio deben ser números positivos" },
        { status: 400 }
      );
    }

    // Validar que la fecha sea válida
    const parsedDate = new Date(operationDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Fecha de operación inválida" }, { status: 400 });
    }

    // Validar Bloqueo Contable
    const [settings, contacts, currencies] = await Promise.all([
      prisma.settings.findFirst({ select: { accountingBlockDate: true } }),
      prisma.contact.findMany({ where: { id: { in: [clientId, providerId] }, deletedAt: null }, select: { id: true } }),
      prisma.currency.findMany({ where: { id: { in: [originCurrencyId, destCurrencyId] }, isActive: true }, select: { id: true } }),
    ]);
    if (settings?.accountingBlockDate && parsedDate < settings.accountingBlockDate) {
      const blockDateStr = new Date(settings.accountingBlockDate).toLocaleDateString("es-AR");
      return NextResponse.json(
        { error: `No se pueden crear operaciones con fecha previa al bloqueo contable (${blockDateStr}).` },
        { status: 400 }
      );
    }

    // Validar longitud de observaciones
    if (observations && typeof observations === "string" && observations.length > 2000) {
      return NextResponse.json({ error: "Las observaciones no pueden superar los 2000 caracteres" }, { status: 400 });
    }

    // Verificar que los IDs referenciados existen
    if (!contacts.some(c => c.id === clientId) || !contacts.some(c => c.id === providerId) ||
      !currencies.some(c => c.id === originCurrencyId) || !currencies.some(c => c.id === destCurrencyId)) {
      return NextResponse.json(
        { error: "Referencias inválidas: cliente, proveedor o monedas no encontradas" },
        { status: 400 }
      );
    }

    // Generar número de operación de forma segura
    const newOp = await prisma.$transaction(async tx => {
      const opNumber = await nextOperationNumber(tx);
      const operation = await tx.operation.create({
      data: {
        operationNumber: opNumber,
        id: randomUUID(),
        clientId,
        providerId,
        originCurrencyId,
        destCurrencyId,
        originAmount: parsedOriginAmount,
        destAmount: parsedDestAmount,
        exchangeRate: parsedExchangeRate,
        operationDate: parsedDate,
        observations: observations ? String(observations).substring(0, 2000) : null,
        state: "PENDING", // Estado siempre fijado desde backend
      },
      });
      await tx.auditLog.create({ data: { userId: user.id, action: "CREATE", entity: "Operation", entityId: operation.id,
        newValues: JSON.stringify({ operationNumber: operation.operationNumber, originAmount: operation.originAmount,
          destAmount: operation.destAmount, state: operation.state }) } });
      return operation;
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json(newOp, { status: 201 });
  } catch (error: any) {
    console.error("Operations POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
