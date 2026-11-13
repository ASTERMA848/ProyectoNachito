import { monetaryJson } from "@/lib/monetary";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { dateOnlyRange, monthKey, monthLabel, monthRange, type DatePreset } from "@/lib/agency-time";
import { combineFilters, ListError, type CurrencySum, type ListParams } from "@/lib/list-query";
import { contactIdsMatching, numberContains, textConditions } from "@/lib/search";
import { OPERATION_STATES, OPERATION_TYPES, TREASURY_TYPES } from "@/lib/operation-labels";

type Where = Prisma.OperationWhereInput;

const STATE_ORDER = Object.keys(OPERATION_STATES);
const TYPE_PARAM: Record<string, string> = {
  single: "SINGLE_SALE",
  distributed: "DISTRIBUTED_SALE",
  standard: "STANDARD",
  treasury_income: "TREASURY_INCOME",
  treasury_expense: "TREASURY_EXPENSE",
  treasury_transfer: "TREASURY_TRANSFER",
};

export const SORT_KEYS = ["number", "date", "created", "client", "provider", "origin", "dest", "state"] as const;
export const GROUP_KEYS = ["state", "originCurrency", "client", "provider", "type", "month"] as const;

const DATE_PRESETS: readonly string[] = ["today", "this_month", "last_month", "this_year"];
// Agrupar por mes suma en memoria: con más filas que esto se pide filtrar antes.
const MONTH_GROUP_LIMIT = 20_000;

function resolveFilter(group: string, value: string): Where | null {
  switch (group) {
    case "state": {
      const state = value.toUpperCase();
      return state in OPERATION_STATES ? { state } : null;
    }
    case "type":
      // "treasury" junta los tres tipos que genera Tesorería.
      if (value === "treasury") return { type: { in: TREASURY_TYPES } };
      return TYPE_PARAM[value] ? { type: TYPE_PARAM[value] } : null;
    case "date":
      return DATE_PRESETS.includes(value) ? { operationDate: dateOnlyRange(value as DatePreset) } : null;
    case "month": {
      const range = monthRange(value);
      return range ? { operationDate: range } : null;
    }
    case "payment":
      if (value === "client_pending") return { isPaid: false };
      if (value === "provider_pending") return { OR: [{ providerIsPaid: false }, { providerIsPaid: null }] };
      return null;
    // client, provider y originCurrency son las claves exactas de una fila de grupo.
    case "client":
      return { clientId: value === "none" ? null : value };
    case "provider":
      return { providerId: value === "none" ? null : value };
    case "originCurrency":
      return { originCurrencyId: value };
    // contact busca a la persona en cualquier rol, también como cliente de una venta distribuida.
    case "contact":
      return { OR: [{ clientId: value }, { providerId: value }, { childOperations: { some: { clientId: value, deletedAt: null } } }] };
    default:
      return null;
  }
}

// Búsqueda por nombre o apellido del contacto, sin tildes: "benitez" encuentra a Carlos Benítez.
const contactIds = (word: string) => contactIdsMatching(word, ["name", "lastname"]);

const byNumber = async (word: string): Promise<Where> => ({ operationNumber: numberContains(word) });
const byClient = async (word: string): Promise<Where> => {
  const ids = await contactIds(word);
  return { OR: [{ clientId: { in: ids } }, { childOperations: { some: { deletedAt: null, clientId: { in: ids } } } }] };
};
const byProvider = async (word: string): Promise<Where> => ({ providerId: { in: await contactIds(word) } });

// Campos por los que se puede buscar puntualmente (qf=client:Benítez).
const SEARCH_BY: Record<string, (word: string) => Promise<Where>> = { number: byNumber, client: byClient, provider: byProvider };
export const SEARCH_FIELDS = Object.keys(SEARCH_BY);

const anyField = async (word: string): Promise<Where> => {
  const ids = await contactIds(word);
  return {
    OR: [
      { operationNumber: numberContains(word) },
      { clientId: { in: ids } },
      { providerId: { in: ids } },
      { childOperations: { some: { deletedAt: null, clientId: { in: ids } } } },
    ],
  };
};

export async function operationsWhere(params: Pick<ListParams, "terms" | "filters" | "fieldTerms">): Promise<Where> {
  const and = combineFilters<Where>(params.filters, resolveFilter);
  and.push(...(await textConditions<Where>(params, anyField, SEARCH_BY)));
  return { deletedAt: null, parentOperationId: null, AND: and };
}

type Order = Prisma.OperationOrderByWithRelationInput;
const ORDER: Record<string, (dir: "asc" | "desc") => Order[]> = {
  number: (dir) => [{ operationNumber: dir }],
  date: (dir) => [{ operationDate: dir }, { createdAt: dir }],
  created: (dir) => [{ createdAt: dir }],
  client: (dir) => [{ client: { name: dir } }],
  provider: (dir) => [{ provider: { name: dir } }],
  origin: (dir) => [{ originAmount: dir }],
  dest: (dir) => [{ destAmount: dir }],
  state: (dir) => [{ state: dir }],
};

const currencySelect = { id: true, code: true, symbol: true, decimals: true } as const;

const contactSelect = { id: true, name: true, lastname: true } as const;

export const operationListInclude = {
  client: { select: contactSelect },
  provider: { select: contactSelect },
  originCurrency: { select: currencySelect },
  destCurrency: { select: currencySelect },
  childOperations: {
    where: { deletedAt: null },
    select: { id: true, clientId: true, isPaid: true, client: { select: contactSelect } },
  },
} satisfies Prisma.OperationInclude;

export type GroupRow = { key: string; filter: string; label: string; count: number; origin: CurrencySum[]; dest: CurrencySum[] };

// Prisma no tipa bien un "by" dinámico: se arma por campo y se lee el resultado como filas planas.
type GroupedRow = Record<string, any> & { _count?: { _all: number }; _sum?: Record<string, Prisma.Decimal | null> };
const groupBy = (args: Record<string, unknown>) => (prisma.operation.groupBy as unknown as (a: unknown) => Promise<GroupedRow[]>)(args);

const GROUP_FIELD: Record<string, string> = {
  state: "state",
  originCurrency: "originCurrencyId",
  client: "clientId",
  provider: "providerId",
  type: "type",
};

function sumsByCurrency(rows: GroupedRow[], currencyField: string, amountField: string, codes: Map<string, string>): CurrencySum[] {
  const totals = new Map<string, Prisma.Decimal>();
  for (const row of rows) totals.set(row[currencyField], (totals.get(row[currencyField]) ?? new Prisma.Decimal(0)).plus(row._sum?.[amountField] ?? 0));
  return Array.from(totals, ([currencyId, sum]) => ({ currencyId, code: codes.get(currencyId) ?? "?", sum: sum.toNumber() })).sort((a, b) => a.code.localeCompare(b.code));
}

async function groupLabels(group: string, keys: (string | null)[], codes: Map<string, string>) {
  const labels = new Map<string | null, string>();
  if (group === "state") keys.forEach((key) => labels.set(key, OPERATION_STATES[key ?? ""] ?? key ?? "Sin estado"));
  if (group === "type") keys.forEach((key) => labels.set(key, OPERATION_TYPES[key ?? ""] ?? key ?? "Sin tipo"));
  if (group === "originCurrency") keys.forEach((key) => labels.set(key, codes.get(key ?? "") ?? "Sin moneda"));
  if (group === "client" || group === "provider") {
    const ids = keys.filter((key): key is string => Boolean(key));
    const contacts = await prisma.contact.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, lastname: true } });
    contacts.forEach((contact) => labels.set(contact.id, [contact.name, contact.lastname].filter(Boolean).join(" ")));
    labels.set(null, group === "client" ? "Varios clientes" : "Sin proveedor");
  }
  return labels;
}

const filterValue = (group: string, key: string | null) => {
  if (group === "state") return (key ?? "").toLowerCase();
  if (group === "type") return Object.keys(TYPE_PARAM).find((param) => TYPE_PARAM[param] === key) ?? (key ?? "").toLowerCase();
  return key ?? "none";
};

async function scalarGroups(group: string, where: Where, codes: Map<string, string>): Promise<GroupRow[]> {
  const field = GROUP_FIELD[group];
  const [counts, origin, dest] = await Promise.all([
    groupBy({ by: [field], where, _count: { _all: true } }),
    groupBy({ by: [field, "originCurrencyId"], where, _sum: { originAmount: true } }),
    groupBy({ by: [field, "destCurrencyId"], where, _sum: { destAmount: true } }),
  ]);
  const labels = await groupLabels(group, counts.map((row) => row[field]), codes);
  const rows = counts.map((row) => {
    const key = row[field] as string | null;
    return {
      key: key ?? "none",
      filter: `${group}:${filterValue(group, key)}`,
      label: labels.get(key) ?? String(key),
      count: row._count?._all ?? 0,
      origin: sumsByCurrency(origin.filter((item) => item[field] === key), "originCurrencyId", "originAmount", codes),
      dest: sumsByCurrency(dest.filter((item) => item[field] === key), "destCurrencyId", "destAmount", codes),
    };
  });
  if (group === "state") return rows.sort((a, b) => STATE_ORDER.indexOf(a.key) - STATE_ORDER.indexOf(b.key));
  return rows.sort((a, b) => a.label.localeCompare(b.label, "es"));
}

async function monthGroups(where: Where, codes: Map<string, string>): Promise<GroupRow[]> {
  const rows = await prisma.operation.findMany({
    where,
    select: { operationDate: true, originCurrencyId: true, originAmount: true, destCurrencyId: true, destAmount: true },
    take: MONTH_GROUP_LIMIT + 1,
  });
  if (rows.length > MONTH_GROUP_LIMIT) throw new ListError("Hay demasiadas operaciones para agrupar por mes. Filtrá por fecha primero.");
  const months = new Map<string, GroupedRow[]>();
  for (const row of rows) {
    const key = monthKey(row.operationDate);
    months.set(key, [...(months.get(key) ?? []), { ...row, _sum: { originAmount: row.originAmount, destAmount: row.destAmount } }]);
  }
  return Array.from(months, ([key, items]) => {
    const label = monthLabel(key);
    return {
      key,
      filter: `month:${key}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      count: items.length,
      origin: sumsByCurrency(items, "originCurrencyId", "originAmount", codes),
      dest: sumsByCurrency(items, "destCurrencyId", "destAmount", codes),
    };
  }).sort((a, b) => b.key.localeCompare(a.key));
}

export async function listOperations(params: ListParams) {
  const where = await operationsWhere(params);
  const sort = params.sort ?? { key: "date", dir: "desc" as const };
  const currencies = await prisma.currency.findMany({ select: { id: true, code: true } });
  const codes = new Map(currencies.map((currency) => [currency.id, currency.code]));

  const [operations, total, originTotals, destTotals, groups] = await Promise.all([
    prisma.operation.findMany({
      relationLoadStrategy: "join",
      where,
      include: operationListInclude,
      orderBy: [...ORDER[sort.key](sort.dir), { id: "desc" }],
      skip: params.offset,
      take: params.limit,
    }),
    prisma.operation.count({ where }),
    groupBy({ by: ["originCurrencyId"], where, _sum: { originAmount: true } }),
    groupBy({ by: ["destCurrencyId"], where, _sum: { destAmount: true } }),
    params.groupBy ? (params.groupBy === "month" ? monthGroups(where, codes) : scalarGroups(params.groupBy, where, codes)) : null,
  ]);

  return {
    operations: monetaryJson(operations),
    total,
    offset: params.offset,
    limit: params.limit,
    totals: {
      origin: sumsByCurrency(originTotals, "originCurrencyId", "originAmount", codes),
      dest: sumsByCurrency(destTotals, "destCurrencyId", "destAmount", codes),
    },
    groups,
  };
}

export type OperationListResult = Awaited<ReturnType<typeof listOperations>>;
export type OperationListItem = OperationListResult["operations"][number];
