import { monetaryJson, positiveDecimal } from "@/lib/monetary";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { AccountingPeriodError } from "@/lib/accounting-period";
import { can } from "@/lib/permissions";
import { ListError, parseListParams } from "@/lib/list-query";
import { GROUP_KEYS, listAccounts, postManualMovement, SEARCH_FIELDS, SORT_KEYS } from "@/lib/resources/accounts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Contrato de listas: ?q=&filter=currency:<id>&filter=sign:negative&groupBy=currency&sort=balance:asc&offset=0&limit=80
    const params = parseListParams(req.nextUrl.searchParams, { sortKeys: SORT_KEYS, groupKeys: GROUP_KEYS, searchFields: SEARCH_FIELDS });
    return NextResponse.json(await listAccounts(params));
  } catch (error: any) {
    if (error instanceof ListError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
    if (!can(user, "accounts.write")) {
      return NextResponse.json({ error: "Tu rol no puede cargar movimientos" }, { status: 403 });
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

    const val = positiveDecimal(amount);
    if (!val) {
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

    const { account, transaction: newTransaction } = await postManualMovement({
      userId: user.id,
      contactId,
      currencyId,
      debit,
      credit,
      concept: concept.trim().substring(0, 500),
      observations: observations ? String(observations).trim().substring(0, 2000) : null,
    });

    return NextResponse.json(monetaryJson({ account, transaction: newTransaction }), { status: 201 });
  } catch (error: any) {
    if (error instanceof AccountingPeriodError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Accounts POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
