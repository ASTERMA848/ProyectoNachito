"use client";

import { useEffect, useState } from "react";
import { Pager } from "@/components/ui";
import { useLeaveGuardContext } from "./LeaveGuard";

// Recorrer los registros de la lista desde la ficha ("3 / 16" con anterior y siguiente).
// La lista guarda el orden de lo que se veía al abrir un registro; se guarda por pestaña del navegador,
// así cada pestaña recorre su propia búsqueda.

const storageKey = (resource: string) => `record-list:${resource}`;
const MAX_IDS = 500;

export function rememberRecordList(resource: string, ids: string[]) {
  try {
    sessionStorage.setItem(storageKey(resource), JSON.stringify(ids.slice(0, MAX_IDS)));
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): la ficha se abre igual, sin el paginador.
  }
}

function readRecordList(resource: string): string[] {
  try {
    const ids: unknown = JSON.parse(sessionStorage.getItem(storageKey(resource)) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function RecordPager({ resource, id, hrefOf, label = "Registros de la lista" }: { resource: string; id: string; hrefOf: (id: string) => string; label?: string }) {
  const { navigate } = useLeaveGuardContext();
  const [ids, setIds] = useState<string[]>([]);
  // sessionStorage solo existe en el navegador: se lee después de montar.
  useEffect(() => setIds(readRecordList(resource)), [resource]);

  const index = ids.indexOf(id);
  if (index < 0 || ids.length < 2) return null;
  return <Pager offset={index} limit={1} total={ids.length} label={label} onChange={(next) => void navigate(hrefOf(ids[next]))} />;
}
