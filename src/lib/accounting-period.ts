import type { Prisma } from "@prisma/client";
import { dateOnlyRange } from "./agency-time";

export class AccountingPeriodError extends Error {
  constructor() {
    super("La fecha es anterior al bloqueo contable del período (cierre contable).");
  }
}

// El cierre y las escrituras contables toman el mismo bloqueo antes de leer datos.
// También fija el orden de bloqueo entre numeración, cuentas corrientes y cajas.
export async function lockAccountingWrites(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(72641001)`;
}

export async function assertOpenAccountingPeriod(tx: Prisma.TransactionClient, ...dates: Date[]) {
  const settings = await tx.settings.findFirst({ select: { accountingBlockDate: true } });
  const cutoff = settings?.accountingBlockDate;
  if (cutoff && dates.some((date) => date < cutoff)) throw new AccountingPeriodError();
}

export function accountingDate(operation: { type: string; operationDate: Date }) {
  return operation.type.startsWith("TREASURY_")
    ? dateOnlyRange("today", operation.operationDate).gte
    : operation.operationDate;
}
