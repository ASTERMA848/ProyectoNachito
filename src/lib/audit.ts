import prisma from './prisma';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'REPORT' | 'SQL_QUERY' | 'UPDATE_STATE' | 'TRANSFER';

interface AuditLogPayload {
  userId?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  query?: string;
  ipAddress?: string;
}

export async function logAudit(payload: AuditLogPayload) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        oldValues: payload.oldValues ? JSON.stringify(payload.oldValues) : undefined,
        newValues: payload.newValues ? JSON.stringify(payload.newValues) : undefined,
        query: payload.query,
        ipAddress: payload.ipAddress,
      }
    });
  } catch (error) {
    console.error('Failed to save audit log:', error);
  }
}
