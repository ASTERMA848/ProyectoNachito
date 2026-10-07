import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (body?.theme !== "LIGHT" && body?.theme !== "DARK") {
      return NextResponse.json({ error: "Seleccione un tema claro u oscuro" }, { status: 400 });
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { theme: body.theme }, select: { theme: true } });
    await logAudit({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, oldValues: { theme: user.theme }, newValues: { theme: updated.theme } });
    return NextResponse.json({ theme: updated.theme });
  } catch (error) {
    console.error("Theme update error:", error);
    return NextResponse.json({ error: "No se pudo guardar el tema. Intente nuevamente." }, { status: 500 });
  }
}
