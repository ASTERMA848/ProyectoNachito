import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Todos los usuarios autenticados pueden ver las monedas (necesario para crear operaciones)
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const currencies = await prisma.currency.findMany({
      orderBy: { code: "asc" },
    });
    return NextResponse.json({ currencies }, { status: 200 });
  } catch (error: any) {
    console.error("Currencies GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { code, name, symbol, decimals, color } = body;

    if (!code || !name || !symbol) {
      return NextResponse.json(
        { error: "Código, nombre y símbolo son requeridos." },
        { status: 400 }
      );
    }

    if (
      typeof code !== "string" ||
      typeof name !== "string" ||
      typeof symbol !== "string"
    ) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Validar código de moneda (alfanumérico, 1-10 chars)
    const trimmedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(trimmedCode)) {
      return NextResponse.json(
        { error: "El código de moneda debe ser alfanumérico (máx. 10 caracteres)" },
        { status: 400 }
      );
    }

    // Validar decimales
    const parsedDecimals = decimals !== undefined ? parseInt(decimals, 10) : 2;
    if (isNaN(parsedDecimals) || parsedDecimals < 0 || parsedDecimals > 8) {
      return NextResponse.json(
        { error: "Los decimales deben ser un número entre 0 y 8" },
        { status: 400 }
      );
    }

    // Validar color hex si se provee
    let safeColor = "#3b82f6";
    if (color && typeof color === "string") {
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        safeColor = color;
      }
    }

    const currency = await prisma.currency.create({
      data: {
        code: trimmedCode,
        name: String(name).trim().substring(0, 100),
        symbol: String(symbol).trim().substring(0, 10),
        decimals: parsedDecimals,
        color: safeColor,
        isActive: true,
      },
    });

    return NextResponse.json({ currency }, { status: 201 });
  } catch (error: any) {
    console.error("Currencies POST error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una moneda con ese código." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
