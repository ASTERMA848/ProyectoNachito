"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Layers } from "lucide-react";
import { iconSize, type Facet, type PanelSection, type SortState } from "@/components/ui";

// Estado de una lista guardado en la URL: filtros, búsqueda, agrupación, orden, página y vista.
// Así los menús de sección pueden abrir una lista ya filtrada y "volver" respeta la búsqueda.

export type FilterGroup = { id: string; label: string; options: { id: string; label: string }[]; collapsible?: boolean };
export type GroupOption = { id: string; label: string };

export type ListChanges = { filter?: string[]; q?: string[]; qf?: string[]; groupBy?: string | null; sort?: string | null; offset?: number; view?: string };
export type SearchField = { id: string; label: string };

export function useListUrlState(defaultSort: SortState, onSearchChange?: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const state = useMemo(() => {
    const params = new URLSearchParams(search);
    const [sortKey, sortDir] = (params.get("sort") ?? "").split(":");
    return {
      filters: params.getAll("filter"),
      terms: params.getAll("q"),
      // Búsquedas en un campo: "client:Benítez".
      fieldTerms: params.getAll("qf"),
      groupBy: params.get("groupBy"),
      sort: sortKey ? { key: sortKey, dir: sortDir === "asc" ? "asc" : "desc" } as SortState : defaultSort,
      offset: Math.max(0, Number(params.get("offset")) || 0),
      view: params.get("view"),
    };
  }, [search, defaultSort]);

  const update = useCallback(
    (changes: ListChanges) => {
      const next = new URLSearchParams(search);
      const setList = (key: string, values: string[]) => {
        next.delete(key);
        values.forEach((value) => next.append(key, value));
      };
      const setOne = (key: string, value: string | null | undefined) => {
        if (value) next.set(key, value);
        else next.delete(key);
      };
      if (changes.filter) setList("filter", changes.filter);
      if (changes.q) setList("q", changes.q);
      if (changes.qf) setList("qf", changes.qf);
      if (changes.groupBy !== undefined) setOne("groupBy", changes.groupBy);
      if (changes.sort !== undefined) setOne("sort", changes.sort);
      if (changes.view) next.set("view", changes.view);
      // Cambiar qué se busca vuelve a la primera página.
      if (changes.filter || changes.q || changes.qf || changes.groupBy !== undefined || changes.sort !== undefined) {
        next.delete("offset");
        onSearchChange?.();
      }
      if (changes.offset !== undefined) setOne("offset", changes.offset ? String(changes.offset) : null);
      const text = next.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [search, pathname, router, onSearchChange],
  );

  // Lo que se busca, sin página ni agrupación: base de las filas de cada grupo.
  const baseQuery = useMemo(() => {
    const params = new URLSearchParams();
    state.terms.forEach((term) => params.append("q", term));
    state.fieldTerms.forEach((term) => params.append("qf", term));
    state.filters.forEach((filter) => params.append("filter", filter));
    params.set("sort", `${state.sort.key}:${state.sort.dir}`);
    return params.toString();
  }, [state]);

  return { ...state, update, baseQuery };
}

type FacetState = { filters: string[]; terms: string[]; fieldTerms: string[]; groupBy: string | null };

// Una faceta por término, una por grupo de filtros (valores unidos con "o") y una por agrupación.
export function buildFacets(
  state: FacetState,
  filterGroups: FilterGroup[],
  groupOptions: GroupOption[],
  extraLabels: Record<string, string> = {},
  searchFields: SearchField[] = [],
): Facet[] {
  const labels = new Map(filterGroups.flatMap((group) => group.options.map((option) => [option.id, option.label] as const)));
  const groupIds = Array.from(new Set(state.filters.map((filter) => filter.split(":")[0])));
  return [
    ...state.terms.map((term) => ({ id: `q:${term}`, kind: "field" as const, values: [term] })),
    ...state.fieldTerms.map((term) => {
      const separator = term.indexOf(":");
      const field = term.slice(0, separator);
      return { id: `qf:${term}`, kind: "field" as const, label: searchFields.find((item) => item.id === field)?.label ?? field, values: [term.slice(separator + 1)] };
    }),
    ...groupIds.map((groupId) => ({
      id: `filter:${groupId}`,
      kind: "filter" as const,
      values: state.filters.filter((filter) => filter.startsWith(`${groupId}:`)).map((filter) => labels.get(filter) ?? extraLabels[filter] ?? filter),
    })),
    ...(state.groupBy ? [{ id: "groupBy", kind: "group" as const, values: [groupOptions.find((option) => option.id === state.groupBy)?.label ?? state.groupBy] }] : []),
  ];
}

export function facetRemoval(id: string, state: FacetState): ListChanges {
  if (id === "groupBy") return { groupBy: null };
  if (id.startsWith("q:")) return { q: state.terms.filter((term) => `q:${term}` !== id) };
  if (id.startsWith("qf:")) return { qf: state.fieldTerms.filter((term) => `qf:${term}` !== id) };
  const group = id.replace("filter:", "");
  return { filter: state.filters.filter((filter) => !filter.startsWith(`${group}:`)) };
}

// Lo que escribió el usuario, como término libre o como búsqueda en un campo.
export function searchChange(state: FacetState, text: string, field: string | null): ListChanges | null {
  const value = text.trim();
  if (!value) return null;
  if (field === null) return state.terms.includes(value) ? null : { q: [...state.terms, value] };
  const term = `${field}:${value}`;
  return state.fieldTerms.includes(term) ? null : { qf: [...state.fieldTerms, term] };
}

// Quita todo lo que se buscó y filtró.
export const clearSearch: ListChanges = { filter: [], q: [], qf: [] };

export const toggleFilter = (filters: string[], id: string) => (filters.includes(id) ? filters.filter((filter) => filter !== id) : [...filters, id]);

// Columnas Filtros y Agrupar por del panel. Un grupo plegable (fechas) se muestra como una opción con sub-opciones.
export function buildPanel(state: FacetState, filterGroups: FilterGroup[], groupOptions: GroupOption[], openCollapsible: Set<string>): PanelSection[] {
  const sections: PanelSection[] = [
    {
      id: "filters",
      title: "Filtros",
      icon: <Filter size={iconSize.sm} />,
      iconTone: "accent",
      groups: filterGroups.map((group) =>
        group.collapsible
          ? [{ id: group.id, label: group.label, expanded: openCollapsible.has(group.id), options: group.options.map((option) => ({ ...option, active: state.filters.includes(option.id) })) }]
          : group.options.map((option) => ({ ...option, active: state.filters.includes(option.id) })),
      ),
    },
  ];
  if (groupOptions.length) {
    sections.push({
      id: "groupBy",
      title: "Agrupar por",
      icon: <Layers size={iconSize.sm} />,
      iconTone: "action",
      groups: [groupOptions.map((option) => ({ ...option, active: state.groupBy === option.id }))],
    });
  }
  return sections;
}

export async function fetchList<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo cargar la lista");
  return data as T;
}
