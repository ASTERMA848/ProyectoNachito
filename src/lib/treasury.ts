import prisma from "./prisma";

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
  return await prisma.$transaction(async (tx: any) => {
    const account = await tx.treasuryAccount.findUnique({
      where: { id: treasuryAccountId },
    });

    if (!account) {
      throw new Error("Treasury account not found");
    }

    // Calcular el nuevo balance. Si es INCOME suma, si es EXPENSE resta.
    let newBalance = account.balance;
    if (type === "INCOME") {
      newBalance += amount;
    } else if (type === "EXPENSE") {
      newBalance -= amount;
    } else {
      // Para TRANSFER o ADJUSTMENT se podría manejar diferente, pero asumimos
      // que amount tiene el signo correcto o se delega a transacciones separadas.
      // Por convención, si es un ajuste positivo será INCOME, si es negativo EXPENSE.
    }

    const movement = await tx.treasuryMovement.create({
      data: {
        treasuryAccountId,
        operationId,
        type,
        amount,
        concept,
        reference,
        observations,
      },
    });

    const updatedAccount = await tx.treasuryAccount.update({
      where: { id: treasuryAccountId },
      data: {
        balance: newBalance,
      },
    });

    return { movement, updatedAccount };
  });
}
