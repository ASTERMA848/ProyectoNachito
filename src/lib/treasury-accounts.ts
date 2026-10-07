import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

// Comparte el bloqueo usado por las ventas distribuidas para evitar que
// abrir tesorería y guardar una operación creen dos cajas para la misma moneda.
export async function ensureCurrencyTreasuryAccounts(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(72641002)`;
  const currencies = await tx.currency.findMany({
    select: { id: true, code: true, treasuries: { where: { isActive: true }, select: { id: true } } },
  });
  const missing = currencies.filter(currency => currency.treasuries.length === 0);
  if (missing.length) {
    await tx.treasuryAccount.createMany({ data: missing.map(currency => ({
      id: randomUUID(), currencyId: currency.id, name: currency.code === "ARS" ? "Caja Base" : `Caja ${currency.code}`,
      type: "CASH", balance: 0, isActive: true,
    })) });
  }
  return tx.treasuryAccount.findMany({ where: { isActive: true }, include: { currency: true }, orderBy: [{ currency: { code: "asc" } }, { name: "asc" }] });
}
