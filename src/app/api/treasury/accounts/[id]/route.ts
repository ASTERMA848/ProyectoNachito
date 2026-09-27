import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// PUT /api/treasury/accounts/[id] — Editar cuenta (nombre, estado)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { name, isActive, type } = body;
    const existing = await prisma.treasuryAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    const updateData: any = {};
    if (name && typeof name === "string") {
      updateData.name = name.trim().substring(0, 100);
    }
    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;
    }
    if (type && ["CASH", "BANK", "WALLET"].includes(type)) {
      updateData.type = type;
    }

    const updated = await prisma.treasuryAccount.update({
      where: { id },
      data: updateData,
      include: { currency: true },
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "TreasuryAccount",
      entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: updated.name, isActive: updated.isActive },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("Treasury account PUT error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

// DELETE /api/treasury/accounts/[id] — Desactivar o eliminar cuenta
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = params;
    const existing = await prisma.treasuryAccount.findUnique({
      where: { id },
      include: { _count: { select: { movements: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    // Si tiene movimientos, la desactivamos en vez de borrarla para no romper la contabilidad
    if (existing._count.movements > 0) {
      const updated = await prisma.treasuryAccount.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: "Cuenta desactivada", account: updated });
    }

    // Si no tiene movimientos, se puede eliminar físicamente
    await prisma.treasuryAccount.delete({ where: { id } });

    await logAudit({
      userId: user.id,
      action: "DELETE",
      entity: "TreasuryAccount",
      entityId: id,
      oldValues: { name: existing.name },
    });

    return NextResponse.json({ success: true, message: "Cuenta eliminada" });
  } catch (error: any) {
    console.error("Treasury account DELETE error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
