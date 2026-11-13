import type { Prisma } from "@prisma/client";
import prisma from './prisma';
import { monetaryJson } from './monetary';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'REPORT' | 'SQL_QUERY' | 'UPDATE_STATE' | 'TRANSFER' | 'UPDATE_STATE_OR_PAY';

interface AuditLogPayload {
  userId?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  query?: string;
  ipAddress?: string;
}

export async function logAudit(payload: AuditLogPayload, db: Pick<Prisma.TransactionClient, "auditLog"> = prisma) {
  await db.auditLog.create({
    data: {
      userId: payload.userId,
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId,
      oldValues: payload.oldValues !== undefined ? JSON.stringify(monetaryJson(payload.oldValues)) : undefined,
      newValues: payload.newValues !== undefined ? JSON.stringify(monetaryJson(payload.newValues)) : undefined,
      query: payload.query,
      ipAddress: payload.ipAddress,
    },
  });
}
