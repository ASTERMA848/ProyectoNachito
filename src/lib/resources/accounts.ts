import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { combineFilters, ListError, type CurrencySum, type ListParams } from "@/lib/list-query";

type Where = Prisma.AccountWhereInput;

export const SORT_KEYS = ["contact", "currency", "balance"] as const;
export const GROUP_KEYS = ["currency", "sign"] as const;

// Saldo = haber - debe. Positivo: la agencia le debe al contacto; negativo: el contacto le debe a la agencia.
const SIGNS: Record<string, { label: string; where: Where }> = {
  positive: { label: "A favor del contacto", where: { balance: { gt: 0 } } },
  negative: { label: "Deuda del contacto", where: { balance: { lt: 0 } } },
  zero: { label: "Saldadas", where: { balance: 0 } },
};

function resolveFilter(group: string, value: string): Where | null {
  switch (group) {
    case "currency":
      return { currencyId: value };
    case "sign":
      return SIGNS[value]?.where ?? null;
    case "role":
      if (value === "client") return { contact: { isClient: true } };
      if (value === "provider") return { contact: { isProvider: true } };
      return null;
    case "contact":
      return { contactId: value };
    default:
      return null;
  }
}

const wordWhere = (word: string): Where => ({
  contact: { OR: ["name", "lastname", "document", "cuitCuil"].map((field) => ({ [field]: { contains: word, mode: "insensitive" } })) },
});

// Cada palabra tiene que aparecer en algún campo del contacto: "Carlos Benítez" junta nombre y apellido.
const termWhere = (term: string): Where => ({ AND: term.split(/\s+/).filter(Boolean).slice(0, 6).map(wordWhere) });

export function accountsWhere(params: Pick<ListParams, "terms" | "filters">): Where {
  const and = combineFilters<Where>(params.filters, resolveFilter);
  // Las cuentas saldadas solo aparecen si se piden, o al mirar las de un contacto.
  if (!params.filters.some((filter) => filter.startsWith("sign:") || filter.startsWith("contact:"))) and.push({ balance: { not: 0 } });
  if (params.terms.length) and.push({ OR: params.terms.map(termWhere) });
  return { contact: { deletedAt: null }, AND: and };
}

const ORDER: Record<string, (dir: "asc" | "desc") => Prisma.AccountOrderByWithRelationInput[]> = {
  contact: (dir) => [{ contact: { name: dir } }, { contact: { lastname: dir } }, { currency: { code: "asc" } }],
  currency: (dir) => [{ currency: { code: dir } }, { contact: { name: "asc" } }],
  balance: (dir) => [{ balance: dir }],
};

export const accountInclude = {
  contact: { select: { id: true, name: true, lastname: true, document: true, cuitCuil: true, isClient: true, isProvider: true, isActive: true } },
  currency: { select: { id: true, code: true, symbol: true, decimals: true } },
} satisfies Prisma.AccountInclude;

// Suma de saldos por moneda: a favor y en contra por separado, porque netearlos esconde la deuda.
async function totalsByCurrency(where: Where) {
  const [positive, negative, currencies] = await Promise.all([
    prisma.account.groupBy({ by: ["currencyId"], where: { AND: [where, { balance: { gt: 0 } }] }, _sum: { balance: true } }),
    prisma.account.groupBy({ by: ["currencyId"], where: { AND: [where, { balance: { lt: 0 } }] }, _sum: { balance: true } }),
    prisma.currency.findMany({ select: { id: true, code: true, decimals: true }, orderBy: { code: "asc" } }),
  ]);
  const sum = (rows: typeof positive, id: string) => rows.find((row) => row.currencyId === id)?._sum.balance ?? 0;
  return currencies
    .map((currency) => ({ currencyId: currency.id, code: currency.code, decimals: currency.decimals, positive: sum(positive, currency.id), negative: sum(negative, currency.id) }))
    .filter((row) => row.positive !== 0 || row.negative !== 0);
}

export async function listAccounts(params: ListParams) {
  const where = accountsWhere(params);
  const sort = params.sort ?? { key: "contact", dir: "asc" as const };
  const [accounts, total, totals, groups] = await Promise.all([
    prisma.account.findMany({ where, include: accountInclude, orderBy: [...ORDER[sort.key](sort.dir), { id: "asc" }], skip: params.offset, take: params.limit }),
    prisma.account.count({ where }),
    totalsByCurrency(where),
    accountGroups(params.groupBy, where),
  ]);
  return { accounts, total, offset: params.offset, limit: params.limit, totals, groups };
}

async function accountGroups(groupBy: string | null, where: Where) {
  if (!groupBy) return null;
  if (groupBy === "currency") {
    const [rows, currencies] = await Promise.all([
      prisma.account.groupBy({ by: ["currencyId"], where, _count: { _all: true }, _sum: { balance: true } }),
      prisma.currency.findMany({ select: { id: true, code: true, decimals: true } }),
    ]);
    return rows
      .map((row) => {
        const currency = currencies.find((item) => item.id === row.currencyId);
        return { key: row.currencyId, filter: `currency:${row.currencyId}`, label: currency?.code ?? "—", count: row._count._all, sums: [{ currencyId: row.currencyId, code: currency?.code ?? "", sum: row._sum.balance ?? 0 }] satisfies CurrencySum[] };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  if (groupBy === "sign") {
    const counts = await Promise.all(Object.entries(SIGNS).map(async ([key, sign]) => ({ key, sign, count: await prisma.account.count({ where: { AND: [where, sign.where] } }) })));
    return counts.filter((row) => row.count > 0).map(({ key, sign, count }) => ({ key, filter: `sign:${key}`, label: sign.label, count, sums: [] as CurrencySum[] }));
  }
  throw new ListError(`No se puede agrupar por ${groupBy}`);
}

export async function accountMovements(accountId: string, offset: number, limit: number) {
  const where = { accountId };
  const [account, transactions, total, newer] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: accountId }, select: { balance: true } }),
    prisma.transaction.findMany({
      where,
      include: { operation: { select: { id: true, operationNumber: true, parentOperationId: true } } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit,
    }),
    prisma.transaction.count({ where }),
    // Movimientos más nuevos que la página: hacen falta para saber el saldo con el que termina.
    offset > 0 ? prisma.transaction.findMany({ where, select: { debit: true, credit: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: offset }) : [],
  ]);
  // El saldo de cada fila se calcula hacia atrás desde el saldo actual. El guardado en cada
  // movimiento queda viejo cuando se edita una venta y sus asientos se vuelven a cargar.
  let running = newer.reduce((balance, row) => balance - (row.credit - row.debit), account.balance);
  const rows = transactions.map((row) => {
    // Redondeo para que la resta de decimales no deje restos como -0,0000001.
    const balance = Math.round(running * 1e8) / 1e8;
    running -= row.credit - row.debit;
    return { ...row, balance };
  });
  return { transactions: rows, total, offset, limit };
}

// Movimiento manual: el saldo se incrementa en la base para que dos cargas simultáneas no se pisen.
export async function postManualMovement(input: { contactId: string; currencyId: string; debit: number; credit: number; concept: string; observations: string | null }) {
  return prisma.$transaction(async (tx) => {
    const amount = input.credit - input.debit;
    const account = await tx.account.upsert({
      where: { contactId_currencyId: { contactId: input.contactId, currencyId: input.currencyId } },
      create: { contactId: input.contactId, currencyId: input.currencyId, balance: amount },
      update: { balance: { increment: amount } },
    });
    const transaction = await tx.transaction.create({
      data: { accountId: account.id, concept: input.concept, debit: input.debit, credit: input.credit, balance: account.balance, observations: input.observations },
    });
    return { account, transaction };
  });
}

export type AccountListResult = Awaited<ReturnType<typeof listAccounts>>;
export type AccountListItem = AccountListResult["accounts"][number];
export type AccountTotals = AccountListResult["totals"];
export type MovementsResult = Awaited<ReturnType<typeof accountMovements>>;
export type MovementItem = MovementsResult["transactions"][number];
