import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { code, name, symbol, decimals, color, isActive } = body;

    // Validar cada campo si se provee
    const updateData: Record<string, any> = {};

    if (code !== undefined) {
      if (typeof code !== "string" || !/^[A-Z0-9]{1,10}$/i.test(code.trim())) {
        return NextResponse.json({ error: "Código de moneda inválido" }, { status: 400 });
      }
      updateData.code = code.trim().toUpperCase();
    }

    if (name !== undefined) {
      updateData.name = String(name).trim().substring(0, 100);
    }

    if (symbol !== undefined) {
      updateData.symbol = String(symbol).trim().substring(0, 10);
    }

    if (decimals !== undefined) {
      const d = parseInt(decimals, 10);
      if (isNaN(d) || d < 0 || d > 8) {
        return NextResponse.json({ error: "Decimales inválidos (0-8)" }, { status: 400 });
      }
      updateData.decimals = d;
    }

    if (color !== undefined) {
      if (typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.color = color;
      }
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const updated = await prisma.currency.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ currency: updated }, { status: 200 });
  } catch (error: any) {
    console.error("Currency PUT error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una moneda con ese código." }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Moneda no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [usedInOps, usedInAccounts] = await Promise.all([
      prisma.operation.count({
        where: {
          OR: [
            { originCurrencyId: params.id },
            { destCurrencyId: params.id },
          ],
        },
      }),
      prisma.account.count({ where: { currencyId: params.id } }),
    ]);

    if (usedInOps > 0 || usedInAccounts > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar esta moneda porque está siendo usada en operaciones o cuentas corrientes." },
        { status: 409 }
      );
    }

    await prisma.currency.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error("Currency DELETE error:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Moneda no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
