"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OperationListResult } from "@/lib/resources/operations";

type Row = OperationListResult["operations"][number];
type GroupState = { status: "loading" | "done" | "error"; rows: Row[] };

export const GROUP_ROW_LIMIT = 80;

// Filas de cada grupo abierto: se piden al abrirlo, con los mismos filtros más la clave del grupo.
export function useGroupRows(baseQuery: string, groups: { key: string; filter: string }[] | null | undefined, open: Set<string>) {
  const [byKey, setByKey] = useState<Record<string, GroupState>>({});
  const current = useRef(baseQuery);

  // Otra búsqueda: lo cargado deja de valer y las respuestas viejas se descartan.
  useEffect(() => {
    current.current = baseQuery;
    setByKey({});
  }, [baseQuery]);

  useEffect(() => {
    for (const group of groups ?? []) {
      if (!open.has(group.key) || byKey[group.key]) continue;
      const query = baseQuery;
      setByKey((state) => ({ ...state, [group.key]: { status: "loading", rows: [] } }));
      const params = new URLSearchParams(query);
      params.append("filter", group.filter);
      params.set("limit", String(GROUP_ROW_LIMIT));
      fetch(`/api/operations?${params}`)
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const data: OperationListResult = await response.json();
          if (current.current === query) setByKey((state) => ({ ...state, [group.key]: { status: "done", rows: data.operations } }));
        })
        .catch(() => {
          if (current.current === query) setByKey((state) => ({ ...state, [group.key]: { status: "error", rows: [] } }));
        });
    }
  }, [baseQuery, groups, open, byKey]);

  const reload = useCallback(() => setByKey({}), []);
  return { byKey, reload };
}
