import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const state = searchParams.get("state") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const where: any = { deletedAt: null, parentOperationId: null };

    if (state) where.state = state;
    if (startDate || endDate) {
      where.operationDate = {};
      if (startDate) where.operationDate.gte = new Date(startDate);
      if (endDate) where.operationDate.lte = new Date(endDate);
    }
    
    if (search) {
      where.OR = [
        { operationNumber: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
        { provider: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [operations, totalCount] = await Promise.all([
      prisma.operation.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, document: true } },
          provider: { select: { id: true, name: true, document: true } },
          originCurrency: { select: { id: true, code: true, symbol: true, color: true } },
          destCurrency: { select: { id: true, code: true, symbol: true, color: true } },
          parentOperation: { select: { id: true, operationNumber: true } },
          childOperations: {
            select: {
              id: true,
              operationNumber: true,
              state: true,
              originAmount: true,
              destAmount: true,
              isPaid: true,
              clientId: true,
              exchangeRate: true,
              observations: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.operation.count({ where })
    ]);

    return NextResponse.json({ 
      operations,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    }, { status: 200 });
  } catch (error: any) {
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
    const settings = await prisma.settings.findFirst();
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
    const [client, provider, originCurrency, destCurrency] = await Promise.all([
      prisma.contact.findFirst({ where: { id: clientId, deletedAt: null } }),
      prisma.contact.findFirst({ where: { id: providerId, deletedAt: null } }),
      prisma.currency.findFirst({ where: { id: originCurrencyId, isActive: true } }),
      prisma.currency.findFirst({ where: { id: destCurrencyId, isActive: true } }),
    ]);

    if (!client || !provider || !originCurrency || !destCurrency) {
      return NextResponse.json(
        { error: "Referencias inválidas: cliente, proveedor o monedas no encontradas" },
        { status: 400 }
      );
    }

    // Generar número de operación de forma segura
    const count = await prisma.operation.count();
    const opNumber = `OP-${String(count + 1).padStart(6, "0")}`;

    const newOp = await prisma.operation.create({
      data: {
        operationNumber: opNumber,
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

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entity: "Operation",
      entityId: newOp.id,
      newValues: {
        operationNumber: newOp.operationNumber,
        originAmount: newOp.originAmount,
        destAmount: newOp.destAmount,
        state: newOp.state,
      },
    });

    return NextResponse.json(newOp, { status: 201 });
  } catch (error: any) {
    console.error("Operations POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
