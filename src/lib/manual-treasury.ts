import { Prisma } from "@prisma/client";
import { nextOperationNumber } from "./distributed-sale";

export class TreasuryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function parseTreasuryInput(body: unknown) {
  const input = body as Record<string, unknown> | null;
  if (!input || typeof input !== "object" || typeof input.accountId !== "string" || !input.accountId.trim())
    throw new TreasuryError("Seleccioná una cuenta de tesorería.");
  if (input.type !== "INCOME" && input.type !== "EXPENSE")
    throw new TreasuryError("Seleccioná ingreso o extracción.");
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0)
    throw new TreasuryError("Ingresá un importe mayor a cero.");
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 500)
    throw new TreasuryError("Ingresá un motivo de hasta 500 caracteres.");
  return { accountId: input.accountId, type: input.type, amount: input.amount, reason: input.reason.trim() };
}

export async function recordManualTreasuryMovement(tx: Prisma.TransactionClient, body: unknown, userId: string) {
  const input = parseTreasuryInput(body);
  const account = await tx.treasuryAccount.findUnique({ where: { id: input.accountId }, include: { currency: true } });
  if (!account || !account.isActive || !account.currency.isActive)
    throw new TreasuryError("La cuenta o su moneda ya no están disponibles. Actualizá tesorería.", 404);
  const scale = 10 ** account.currency.decimals;
  if (!Number.isSafeInteger(Math.round(input.amount * scale)) || Math.abs(input.amount * scale - Math.round(input.amount * scale)) > 0.000001)
    throw new TreasuryError(`El importe debe tener como máximo ${account.currency.decimals} decimales.`);

  // La condición y el incremento son atómicos: dos extracciones simultáneas
  // no pueden usar el mismo saldo ni sobrescribir otros movimientos.
  const updated = await tx.treasuryAccount.updateMany({
    where: { id: account.id, isActive: true, ...(input.type === "EXPENSE" ? { balance: { gte: input.amount } } : {}) },
    data: { balance: { increment: input.type === "INCOME" ? input.amount : -input.amount } },
  });
  if (updated.count !== 1) throw new TreasuryError("Saldo insuficiente para esta extracción. Actualizá el saldo o reducí el importe.", 409);
  const updatedAccount = await tx.treasuryAccount.findUniqueOrThrow({ where: { id: account.id }, include: { currency: true } });

  const opNumber = await nextOperationNumber(tx as any);
  const operation = await tx.operation.create({
    data: {
      operationNumber: opNumber,
      type: input.type === "INCOME" ? "TREASURY_INCOME" : "TREASURY_EXPENSE",
      originCurrencyId: account.currencyId,
      destCurrencyId: account.currencyId,
      originAmount: input.amount,
      destAmount: input.amount,
      exchangeRate: 1,
      operationDate: new Date(),
      isPaid: true,
      providerIsPaid: true,
      state: "COMPLETED",
      observations: input.reason,
    },
  });

  const movement = await tx.treasuryMovement.create({
    data: { treasuryAccountId: account.id, operationId: operation.id, type: input.type, amount: input.amount, concept: input.reason },
    include: { account: { include: { currency: true } }, operation: { select: { operationNumber: true } } },
  });
  await tx.auditLog.create({ data: {
    userId, action: "CREATE", entity: "TreasuryMovement", entityId: movement.id,
    oldValues: JSON.stringify({ balance: updatedAccount.balance + (input.type === "INCOME" ? -input.amount : input.amount) }),
    newValues: JSON.stringify({ ...input, currency: account.currency.code, balance: updatedAccount.balance }),
  } });
  return { account: updatedAccount, movement };
}
