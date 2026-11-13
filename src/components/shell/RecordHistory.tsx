"use client";

import useSWR from "swr";
import { HistoryPanel, type HistoryGroup } from "@/components/ui";
import { fetchList } from "./list-state";
import styles from "./RecordHistory.module.css";

type HistoryEntity = "Operation" | "Contact" | "User" | "Currency" | "Account" | "TreasuryAccount";

// Historial de una ficha armado desde la auditoría. refreshKey cambia cuando la ficha se guarda.
export function RecordHistory({ entity, id, refreshKey, emptyText = "Todavía no hay cambios registrados." }: { entity: HistoryEntity; id: string; refreshKey?: unknown; emptyText?: string }) {
  const { data, error } = useSWR<{ groups: HistoryGroup[] }>(["history", entity, id, refreshKey], () => fetchList(`/api/history?entity=${entity}&id=${id}`));
  if (error) return <p role="alert">No se pudo cargar el historial.</p>;
  return <HistoryPanel groups={data?.groups ?? []} emptyText={data ? emptyText : "Cargando el historial..."} />;
}

// El último cambio de un campo puntual, sin abrir el historial: los grupos ya vienen del más
// nuevo al más viejo (y cada uno, por dentro, también). Devuelve null si nunca cambió.
export function findLatestFieldChange(groups: HistoryGroup[] | undefined, field: string) {
  for (const group of groups ?? []) {
    for (const entry of group.entries) {
      if (entry.kind !== "change") continue;
      const change = entry.changes.find((item) => item.field === field);
      if (change) return { ...change, day: group.label, at: entry.at, author: entry.author };
    }
  }
  return null;
}

// Aviso al lado del campo: quién lo cambió y cuándo, sin un clic extra para abrir el historial.
// Es un <span> (no un <p>) para poder usarse tanto dentro del "help" de Field (que ya es un <p>)
// como dentro de un ReadonlyField.
export function FieldChangeNote({ groups, field }: { groups: HistoryGroup[] | undefined; field: string }) {
  const change = findLatestFieldChange(groups, field);
  if (!change) return null;
  return (
    <span className={styles.note}>
      Último cambio: {change.from} → {change.to} · {change.day} {change.at} ({change.author})
    </span>
  );
}
