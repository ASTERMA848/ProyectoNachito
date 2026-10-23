import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";

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

    const current = await prisma.currency.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: "Moneda no encontrada" }, { status: 404 });
    }
    const updated = await prisma.currency.update({
      where: { id: params.id },
      data: updateData,
    });
    const fields = ["code", "name", "symbol", "decimals", "isActive"] as const;
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Currency",
      entityId: updated.id,
      oldValues: Object.fromEntries(fields.map((field) => [field, current[field]])),
      newValues: Object.fromEntries(fields.map((field) => [field, updated[field]])),
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

    const [usedInOps, usedInAccounts, usedInTreasury] = await Promise.all([
      prisma.operation.count({
        where: {
          OR: [
            { originCurrencyId: params.id },
            { destCurrencyId: params.id },
            { providerPaymentCurrencyId: params.id },
          ],
        },
      }),
      prisma.account.count({ where: { currencyId: params.id } }),
      prisma.treasuryAccount.count({ where: { currencyId: params.id, OR: [{ balance: { not: 0 } }, { movements: { some: {} } }] } }),
    ]);

    if (usedInOps > 0 || usedInAccounts > 0 || usedInTreasury > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar esta moneda porque está siendo usada en operaciones, cuentas corrientes o cajas. Podés desactivarla." },
        { status: 409 }
      );
    }

    const settings = await prisma.settings.findFirst({ select: { mainCurrencyId: true } });
    if (settings?.mainCurrencyId === params.id) {
      return NextResponse.json({ error: "Es la moneda principal. Elegí otra en Configuración antes de eliminarla." }, { status: 409 });
    }

    // Las cajas vacías que se crearon solas para la moneda se van con ella.
    const deleted = await prisma.$transaction(async (tx) => {
      await tx.treasuryAccount.deleteMany({ where: { currencyId: params.id } });
      return tx.currency.delete({ where: { id: params.id } });
    });
    await logAudit({ userId: user.id, action: "DELETE", entity: "Currency", entityId: deleted.id, oldValues: { code: deleted.code, name: deleted.name } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error("Currency DELETE error:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Moneda no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
