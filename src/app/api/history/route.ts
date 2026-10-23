import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { can } from "@/lib/permissions";
import { dayKey, dayLabel } from "@/lib/agency-time";
import { describeAuditLog, type HistoryEntry } from "@/lib/history";

export const dynamic = "force-dynamic";

// Entidades con historial en la interfaz nueva; se suman a medida que se migra cada pantalla.
const ENTITIES = new Set(["Operation"]);
const MAX_ENTRIES = 200;

// GET /api/history?entity=Operation&id=<id>: historial agrupado por día local de la agencia.
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") ?? "";
    const entityId = searchParams.get("id") ?? "";
    if (!ENTITIES.has(entity) || !/^[\w-]{1,64}$/.test(entityId)) {
      return NextResponse.json({ error: "Registro inválido" }, { status: 400 });
    }

    // Una venta distribuida registra los cambios en la operación agrupadora; se suman sus líneas por las dudas.
    const ids = [entityId];
    if (entity === "Operation") {
      const children = await prisma.operation.findMany({ where: { parentOperationId: entityId }, select: { id: true } });
      ids.push(...children.map((child) => child.id));
    }

    const logs = await prisma.auditLog.findMany({
      where: { entity, entityId: { in: ids } },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ENTRIES,
    });

    const detailed = can(user, "audit.read");
    const days = new Map<string, HistoryEntry[]>();
    for (const log of logs) {
      const key = dayKey(log.createdAt);
      days.set(key, [...(days.get(key) ?? []), describeAuditLog(log, detailed)]);
    }

    return NextResponse.json({ groups: Array.from(days, ([key, entries]) => ({ label: dayLabel(key), entries })) }, { status: 200 });
  } catch (error) {
    console.error("History GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
