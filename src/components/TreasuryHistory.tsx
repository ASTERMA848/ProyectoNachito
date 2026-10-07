"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import styles from "./TreasuryHistory.module.css";

type Movement = { id: string; date: string; type: string; amount: number; concept: string; reference: string | null; observations: string | null; operation: { operationNumber: string } | null };
type History = { account: { name: string; balance: number; currency: { code: string; decimals: number } }; movements: Movement[]; total: number; page: number; pageSize: number };
async function fetchHistory(url: string): Promise<History> {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo cargar el historial.");
  return data;
}

export default function TreasuryHistory({ accountId, accountName, onClose }: { accountId: string; accountName: string; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const section = useRef<HTMLElement>(null);
  const { data, error, isLoading, mutate } = useSWR(`/api/treasury/${encodeURIComponent(accountId)}/movements?page=${page}`, fetchHistory);
  useEffect(() => { section.current?.scrollIntoView({ block: "start" }); section.current?.focus({ preventScroll: true }); }, []);
  function formatAmount(amount: number) {
    const currency = data!.account.currency;
    return `${amount.toLocaleString("es-AR", { minimumFractionDigits: Math.min(2, currency.decimals), maximumFractionDigits: currency.decimals })} ${currency.code}`;
  }
  return <section ref={section} tabIndex={-1} className={styles.section} aria-labelledby="treasury-history-title">
    <div className={styles.heading}>
      <div><h2 id="treasury-history-title">Historial de {data?.account.name || accountName}</h2>
        <p>{data ? `${data.total} movimientos · Saldo actual: ${formatAmount(data.account.balance)}` : "Operaciones y movimientos manuales de esta caja."}</p>
      </div>
      <button type="button" className="flowbite-btn flowbite-btn-secondary" onClick={onClose}>Ver todas las cajas</button>
    </div>
    {error ? <div role="alert" className={styles.message}><p>{error.message}</p><button type="button" className="flowbite-btn flowbite-btn-secondary" onClick={() => { void mutate().catch(() => {}); }}>Reintentar</button></div>
      : isLoading || !data ? <p role="status" className={styles.message}>Cargando historial…</p>
      : data.total === 0 ? <p className={styles.message}>Esta caja todavía no tiene movimientos.</p>
      : <>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Fecha</th><th>Movimiento</th><th>Operación</th><th>Motivo / concepto</th><th className={styles.amount}>Importe</th></tr></thead>
            <tbody>{data.movements.map(movement => {
              const income = movement.type === "INCOME";
              const expense = movement.type === "EXPENSE";
              const label = income ? "Ingreso" : expense ? (movement.operation ? "Egreso" : "Extracción") : movement.type === "TRANSFER" ? "Transferencia" : movement.type === "ADJUSTMENT" ? "Ajuste" : movement.type;
              return <tr key={movement.id}>
                <td className={styles.date}>{new Date(movement.date).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td>{label}</td>
                <td>{movement.operation?.operationNumber || "Manual / ajuste"}</td>
                <td className={styles.concept}>{movement.concept}
                  {movement.reference && <small>Referencia: {movement.reference}</small>}
                  {movement.observations && <small>{movement.observations}</small>}
                </td>
                <td className={styles.amount} style={{ color: income ? "var(--ots-success)" : expense ? "var(--ots-danger)" : "var(--ots-text-primary)" }}>{income ? "+ " : expense ? "− " : ""}{formatAmount(movement.amount)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <nav className={styles.pagination} aria-label="Páginas del historial">
          <span aria-live="polite">Página {page} de {Math.max(1, Math.ceil(data.total / data.pageSize))} · {data.movements.length} movimientos</span>
          <div><button type="button" className="flowbite-btn flowbite-btn-secondary" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Anterior</button>
            <button type="button" className="flowbite-btn flowbite-btn-secondary" disabled={page * data.pageSize >= data.total} onClick={() => setPage(current => current + 1)}>Siguiente</button></div>
        </nav>
      </>}
  </section>;
}
