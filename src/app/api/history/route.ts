import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { can } from "@/lib/permissions";
import { dayKey, dayLabel } from "@/lib/agency-time";
import { describeAuditLog, type HistoryEntry } from "@/lib/history";

export const dynamic = "force-dynamic";

// Entidades con historial en la interfaz nueva.
const ENTITIES = new Set(["Operation", "Contact", "User", "Currency", "Account", "TreasuryAccount"]);
const MAX_ENTRIES = 200;

// Qué registros de auditoría forman el historial de cada tipo de ficha.
async function historyWhere(entity: string, entityId: string): Promise<Prisma.AuditLogWhereInput> {
  // Una venta distribuida registra los cambios en la operación agrupadora; se suman sus líneas por las dudas.
  if (entity === "Operation") {
    const children = await prisma.operation.findMany({ where: { parentOperationId: entityId }, select: { id: true } });
    return { entity, entityId: { in: [entityId, ...children.map((child) => child.id)] } };
  }
  // Los movimientos manuales de una cuenta guardan su accountId en los valores nuevos.
  if (entity === "Account") return { entity: "Transaction", newValues: { contains: `"accountId":"${entityId}"` } };
  // Movimientos de una caja y traspasos donde la caja es origen o destino.
  if (entity === "TreasuryAccount") {
    return {
      OR: [
        { entity: "TreasuryMovement", newValues: { contains: `"accountId":"${entityId}"` } },
        { entity: "TreasuryTransfer", newValues: { contains: `"originAccountId":"${entityId}"` } },
        { entity: "TreasuryTransfer", newValues: { contains: `"destAccountId":"${entityId}"` } },
      ],
    };
  }
  return { entity, entityId };
}

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

    // Los cambios de usuarios los ven quienes administran o auditan, y cada uno los propios.
    if (entity === "User" && entityId !== user.id && !can(user, "settings.write") && !can(user, "audit.read")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      where: await historyWhere(entity, entityId),
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
