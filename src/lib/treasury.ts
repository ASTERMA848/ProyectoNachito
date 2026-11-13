import prisma from "./prisma";
import { assertOpenAccountingPeriod, lockAccountingWrites } from "./accounting-period";
import { dateOnlyRange } from "./agency-time";
import { positiveDecimal } from "./monetary";

/**
 * Registra un movimiento directo en una cuenta de tesorería (ingreso o egreso).
 * Refleja exactamente la cantidad de dinero físico/digital que entra o sale.
 */
export async function registerTreasuryMovement({
  treasuryAccountId,
  type,
  amount,
  operationId,
  concept,
  reference,
  observations,
}: {
  treasuryAccountId: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  amount: number;
  operationId?: string;
  concept: string;
  reference?: string;
  observations?: string;
}) {
  const decimalAmount = positiveDecimal(amount);
  if (!decimalAmount) throw new Error("Importe de tesorería inválido.");
  return prisma.$transaction(async (tx) => {
    await lockAccountingWrites(tx);
    await assertOpenAccountingPeriod(tx, dateOnlyRange("today").gte);
    const account = await tx.treasuryAccount.findUnique({
      where: { id: treasuryAccountId },
    });

    if (!account) {
      throw new Error("Treasury account not found");
    }

    const movement = await tx.treasuryMovement.create({
      data: {
        treasuryAccountId,
        operationId,
        type,
        amount: decimalAmount,
        concept,
        reference,
        observations,
      },
    });

    const updatedAccount = await tx.treasuryAccount.update({
      where: { id: treasuryAccountId },
      data: {
        balance: {
          increment: type === "INCOME" ? decimalAmount : type === "EXPENSE" ? decimalAmount.negated() : 0,
        },
      },
    });

    return { movement, updatedAccount };
  });
}
