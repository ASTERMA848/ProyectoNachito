import prisma from "@/lib/prisma";
import { dayKey } from "@/lib/agency-time";
import { ensureCurrencyTreasuryAccounts } from "@/lib/treasury-accounts";

const DAY_MS = 86_400_000;
export const MAX_SERIES_DAYS = 90;

// Efecto de un movimiento sobre el saldo de su caja.
const signed = (movement: { type: string; amount: number }) => (movement.type === "EXPENSE" ? -movement.amount : movement.amount);
const round = (value: number) => Math.round(value * 1e8) / 1e8;

// Tablero: cada caja con su saldo, lo que entró y salió hoy y el saldo al cierre de cada día.
// La serie se arma hacia atrás desde el saldo actual, así siempre termina en el saldo real.
export async function treasuryDashboard(days: number, now = new Date()) {
  const accounts = await prisma.$transaction(ensureCurrencyTreasuryAccounts);
  const keys = Array.from({ length: days }, (_, index) => dayKey(new Date(now.getTime() - (days - 1 - index) * DAY_MS)));
  const today = keys[keys.length - 1];

  // Un día de margen: el primer día local puede empezar antes en UTC.
  const movements = await prisma.treasuryMovement.findMany({
    where: { treasuryAccountId: { in: accounts.map((account) => account.id) }, date: { gte: new Date(now.getTime() - (days + 1) * DAY_MS) } },
    select: { treasuryAccountId: true, type: true, amount: true, date: true },
  });

  const cards = accounts.map((account) => {
    const net = new Map<string, number>();
    let income = 0;
    let expense = 0;
    let movementsToday = 0;
    for (const movement of movements) {
      if (movement.treasuryAccountId !== account.id) continue;
      const key = dayKey(movement.date);
      net.set(key, (net.get(key) ?? 0) + signed(movement));
      if (key === today) {
        movementsToday += 1;
        if (movement.type === "EXPENSE") expense += movement.amount;
        else income += movement.amount;
      }
    }
    const series = new Array<number>(days);
    let closing = account.balance;
    for (let index = days - 1; index >= 0; index -= 1) {
      series[index] = round(closing);
      closing -= net.get(keys[index]) ?? 0;
    }
    return { ...account, today: { income: round(income), expense: round(expense), count: movementsToday }, series };
  });

  const recent = await prisma.treasuryMovement.findMany({
    take: 15,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { account: { select: { id: true, name: true, currency: { select: { code: true, decimals: true } } } }, operation: { select: { id: true, operationNumber: true, parentOperationId: true } } },
  });

  return { accounts: cards, recent, days: keys };
}

// Movimientos de una caja con el saldo que dejó cada uno, calculado desde el saldo actual.
export async function treasuryMovements(accountId: string, offset: number, limit: number) {
  const account = await prisma.treasuryAccount.findUnique({ where: { id: accountId }, include: { currency: true } });
  if (!account) return null;
  const where = { treasuryAccountId: account.id };
  const order = [{ date: "desc" as const }, { id: "desc" as const }];
  const [movements, total, newer] = await Promise.all([
    prisma.treasuryMovement.findMany({ where, orderBy: order, skip: offset, take: limit, include: { operation: { select: { id: true, operationNumber: true, parentOperationId: true, type: true } } } }),
    prisma.treasuryMovement.count({ where }),
    offset > 0 ? prisma.treasuryMovement.findMany({ where, orderBy: order, take: offset, select: { type: true, amount: true } }) : [],
  ]);
  let running = newer.reduce((balance, movement) => balance - signed(movement), account.balance);
  const rows = movements.map((movement) => {
    const balance = round(running);
    running -= signed(movement);
    return { ...movement, balance };
  });
  return { account, movements: rows, total, offset, limit };
}

export type TreasuryDashboard = Awaited<ReturnType<typeof treasuryDashboard>>;
export type TreasuryCard = TreasuryDashboard["accounts"][number];
export type RecentMovement = TreasuryDashboard["recent"][number];
export type TreasuryMovements = NonNullable<Awaited<ReturnType<typeof treasuryMovements>>>;
export type TreasuryMovementRow = TreasuryMovements["movements"][number];
