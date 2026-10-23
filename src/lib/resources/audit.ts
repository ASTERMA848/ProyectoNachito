import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { combineFilters, type ListParams } from "@/lib/list-query";
import { instantRange, type InstantPreset } from "@/lib/agency-time";
import { describeAuditLog } from "@/lib/history";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-labels";

type Where = Prisma.AuditLogWhereInput;

export const SORT_KEYS = ["created"] as const;
export const GROUP_KEYS = ["entity", "action", "user"] as const;

const PRESETS = new Set<InstantPreset>(["today", "last_7", "this_month"]);

function resolveFilter(group: string, value: string): Where | null {
  switch (group) {
    case "action":
      return { action: value };
    case "entity":
      // "none" agrupa los registros sin entidad (por ejemplo, consultas SQL).
      return value === "none" ? { entity: null } : { entity: value };
    case "user":
      return value === "none" ? { userId: null } : { userId: value };
    case "date":
      return PRESETS.has(value as InstantPreset) ? { createdAt: instantRange(value as InstantPreset) } : null;
    default:
      return null;
  }
}

const termWhere = (term: string): Where => ({
  OR: [
    { entityId: { contains: term, mode: "insensitive" } },
    { newValues: { contains: term, mode: "insensitive" } },
    { oldValues: { contains: term, mode: "insensitive" } },
    { query: { contains: term, mode: "insensitive" } },
    { ipAddress: { contains: term } },
    { user: { username: { contains: term, mode: "insensitive" } } },
  ],
});

export function auditWhere(params: Pick<ListParams, "terms" | "filters">): Where {
  const and = combineFilters<Where>(params.filters, resolveFilter);
  if (params.terms.length) and.push({ OR: params.terms.map(termWhere) });
  return { AND: and };
}

function parse(json: string | null) {
  if (!json) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return json;
  }
}

// Fila de auditoría lista para mostrar: frase legible más los valores crudos para el detalle.
function present(log: Prisma.AuditLogGetPayload<{ include: { user: { select: { id: true; username: true } } } }>) {
  return {
    id: log.id,
    createdAt: log.createdAt,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    user: log.user,
    ipAddress: log.ipAddress,
    query: log.query,
    before: parse(log.oldValues),
    after: parse(log.newValues),
    summary: describeAuditLog(log, true),
  };
}

export async function listAudit(params: ListParams) {
  const where = auditWhere(params);
  const dir = params.sort?.dir ?? "desc";
  const include = { user: { select: { id: true, username: true } } } as const;
  const [logs, total, groups] = await Promise.all([
    prisma.auditLog.findMany({ where, include, orderBy: [{ createdAt: dir }, { id: dir }], skip: params.offset, take: params.limit }),
    prisma.auditLog.count({ where }),
    auditGroups(params.groupBy, where),
  ]);
  return { logs: logs.map(present), total, offset: params.offset, limit: params.limit, groups };
}

async function auditGroups(groupBy: string | null, where: Where) {
  if (groupBy === "entity" || groupBy === "action") {
    const rows = await prisma.auditLog.groupBy({ by: [groupBy], where, _count: { _all: true } });
    const labels = groupBy === "entity" ? AUDIT_ENTITIES : AUDIT_ACTIONS;
    return rows
      .map((row) => {
        const key = (groupBy === "entity" ? row.entity : row.action) ?? "none";
        return { key, filter: `${groupBy}:${key}`, label: key === "none" ? "Sin registro" : labels[key] ?? key, count: row._count._all };
      })
      .sort((a, b) => b.count - a.count);
  }
  if (groupBy === "user") {
    const rows = await prisma.auditLog.groupBy({ by: ["userId"], where, _count: { _all: true } });
    const users = await prisma.user.findMany({ where: { id: { in: rows.flatMap((row) => (row.userId ? [row.userId] : [])) } }, select: { id: true, username: true } });
    return rows
      .map((row) => {
        const key = row.userId ?? "none";
        return { key, filter: `user:${key}`, label: users.find((user) => user.id === row.userId)?.username ?? "Sistema", count: row._count._all };
      })
      .sort((a, b) => b.count - a.count);
  }
  return null;
}

export type AuditListResult = Awaited<ReturnType<typeof listAudit>>;
export type AuditRow = AuditListResult["logs"][number];
