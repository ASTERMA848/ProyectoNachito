"use client";

import useSWR from "swr";
import { HistoryPanel, type HistoryGroup } from "@/components/ui";
import { fetchList } from "./list-state";

type HistoryEntity = "Operation" | "Contact" | "User" | "Currency" | "Account" | "TreasuryAccount";

// Historial de una ficha armado desde la auditoría. refreshKey cambia cuando la ficha se guarda.
export function RecordHistory({ entity, id, refreshKey, emptyText = "Todavía no hay cambios registrados." }: { entity: HistoryEntity; id: string; refreshKey?: unknown; emptyText?: string }) {
  const { data, error } = useSWR<{ groups: HistoryGroup[] }>(["history", entity, id, refreshKey], () => fetchList(`/api/history?entity=${entity}&id=${id}`));
  if (error) return <p role="alert">No se pudo cargar el historial.</p>;
  return <HistoryPanel groups={data?.groups ?? []} emptyText={data ? emptyText : "Cargando el historial..."} />;
}
