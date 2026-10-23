// Contrato de listas (replica/architecture.md): q, filter, groupBy, sort, offset y limit.
// Cada recurso define en src/lib/resources qué filtros, agrupaciones y órdenes acepta.

export const DEFAULT_LIMIT = 80;
export const MAX_LIMIT = 100;

export type SortDir = "asc" | "desc";

export type ListParams = {
  // q puede repetirse: los términos se combinan con O.
  terms: string[];
  // "grupo:valor", por ejemplo "state:pending" o "date:this_month".
  filters: string[];
  groupBy: string | null;
  sort: { key: string; dir: SortDir } | null;
  offset: number;
  limit: number;
};

export class ListError extends Error {}

const FILTER_PATTERN = /^[a-zA-Z]+:[\w-]{1,64}$/;

const toInt = (value: string | null) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : 0;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function parseListParams(
  searchParams: URLSearchParams,
  config: { sortKeys: readonly string[]; groupKeys: readonly string[] },
): ListParams {
  const terms = searchParams.getAll("q").map((term) => term.trim().slice(0, 200)).filter(Boolean).slice(0, 5);
  const filters = searchParams.getAll("filter").map((filter) => filter.trim());
  const badFilter = filters.find((filter) => !FILTER_PATTERN.test(filter));
  if (badFilter !== undefined) throw new ListError(`Filtro inválido: ${badFilter.slice(0, 80)}`);
  if (filters.length > 30) throw new ListError("Demasiados filtros");

  const groupParam = searchParams.get("groupBy");
  if (groupParam && !config.groupKeys.includes(groupParam)) throw new ListError(`No se puede agrupar por ${groupParam.slice(0, 40)}`);

  const [sortKey, sortDir] = (searchParams.get("sort") || "").split(":");
  const sort = config.sortKeys.includes(sortKey) ? { key: sortKey, dir: sortDir === "asc" ? ("asc" as const) : ("desc" as const) } : null;

  return {
    terms,
    filters,
    groupBy: groupParam || null,
    sort,
    offset: clamp(toInt(searchParams.get("offset")), 0, 1_000_000),
    limit: clamp(toInt(searchParams.get("limit")) || DEFAULT_LIMIT, 1, MAX_LIMIT),
  };
}

// Dentro de un grupo los filtros se combinan con O; entre grupos distintos, con Y.
export function combineFilters<W extends object>(filters: string[], resolve: (group: string, value: string) => W | null): W[] {
  const byGroup = new Map<string, W[]>();
  for (const filter of filters) {
    const separator = filter.indexOf(":");
    const group = filter.slice(0, separator);
    const where = resolve(group, filter.slice(separator + 1));
    if (!where) throw new ListError(`Filtro inválido: ${filter}`);
    byGroup.set(group, [...(byGroup.get(group) ?? []), where]);
  }
  return Array.from(byGroup.values()).map((list) => (list.length === 1 ? list[0] : ({ OR: list } as unknown as W)));
}

export type CurrencySum = { currencyId: string; code: string; sum: number };
