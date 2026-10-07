"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  LiquidTableContainer,
  LiquidTable,
  LiquidTableHead,
  LiquidTableBody,
  LiquidTableRow,
  LiquidTableHeaderCell,
  LiquidTableCell,
} from "@liquefy-ui/react";
import { BriefcaseIcon } from "@liquefy-ui/icons";
import TreasuryMovementDialog from "@/components/TreasuryMovementDialog";
import TreasuryTransferDialog from "@/components/TreasuryTransferDialog";
import TreasuryHistory from "@/components/TreasuryHistory";
import styles from "./treasury.module.css";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo cargar tesorería.");
  return result;
};

export default function TreasuryPage() {
  const { mutate: refreshHistory } = useSWRConfig();
  const { data, error, isLoading: loading, mutate: fetchTreasury } = useSWR("/api/treasury", fetcher);
  const [movementAccountId, setMovementAccountId] = useState<string | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<{ id: string; name: string } | null>(null);

  const accounts = data?.accounts || [];
  const movements = data?.movements || [];

  const formatNumber = (val: number | undefined | null, currencyCode: string, decimals = 2) => {
    const num = typeof val === "number" ? val : 0;
    try {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: Math.min(2, decimals),
        maximumFractionDigits: decimals,
      }).format(num);
    } catch {
      return `${currencyCode} ${num.toLocaleString("es-AR", { minimumFractionDigits: Math.min(2, decimals), maximumFractionDigits: decimals })}`;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--ots-primary)",
              backgroundColor: "var(--ots-primary-muted)",
              padding: "4px 12px",
              borderRadius: "999px",
              display: "inline-block",
              marginBottom: "8px",
            }}
          >
            DISPONIBILIDAD REAL
          </span>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--ots-text-primary)", letterSpacing: "-0.02em", margin: "2px 0 4px 0", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "var(--ots-primary)", display: "flex", alignItems: "center" }}><BriefcaseIcon size={28} /></span>
            Tesorería y Cuentas Físicas
          </h1>
          <p style={{ fontSize: "14px", color: "var(--ots-text-secondary)", marginTop: "4px" }}>
            Visualiza el dinero real disponible en tus cajas y billeteras.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {data?.canManage && (
            <button
              type="button"
              onClick={() => setIsTransferOpen(true)}
              className="flowbite-btn flowbite-btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
              </svg>
              Traspaso / Conversión
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void fetchTreasury().catch(() => {});
              void refreshHistory(key => typeof key === "string" && key.startsWith("/api/treasury/")).catch(() => {});
            }}
            className="flowbite-btn flowbite-btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* Cajas (Cards de Cuentas de Tesorería) */}
      {error ? <p role="alert" style={{ color: "var(--ots-danger)" }}>No se pudo cargar tesorería. Usá Actualizar para intentar nuevamente.</p> : loading ? (
        <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--ots-text-secondary)", fontSize: "14px" }}>Cargando cajas de tesorería...</span>
        </div>
      ) : (
        <>
          {accounts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: "var(--ots-text-secondary)", backgroundColor: "var(--ots-surface-1)", borderRadius: "var(--ots-radius-lg)", border: "1px solid var(--ots-border)", marginBottom: "2rem" }}>
              No hay monedas creadas todavía. Agregá una moneda en Configuración para ver su caja en Tesorería.
            </div>
          ) : (
            <div className={styles.accounts}>
              {accounts.map((acc) => {
                const isPositive = (acc.balance || 0) >= 0;
                const curCode = acc.currency?.code || "ARS";
                const curColor = acc.currency?.color || "#3b82f6";
                return (
                  <div
                    key={acc.id}
                    className={styles.account}
                  >
                    <div className={styles.accountHeading}>
                      <span className={styles.accountName}>
                        {acc.name}
                      </span>
                      <span 
                        style={{ 
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "999px",
                          backgroundColor: `${curColor}20`, 
                          color: curColor,
                          border: `1px solid ${curColor}40`
                        }}
                      >
                        {curCode}{!acc.currency?.isActive ? " · Inactiva" : ""}
                      </span>
                    </div>
                    
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--ots-text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Saldo Disponible
                      </span>
                      <div className={styles.balance}
                        style={{ color: isPositive ? "var(--ots-text-primary)" : "var(--ots-danger)" }}
                      >
                        {formatNumber(acc.balance, curCode, acc.currency?.decimals ?? 2)}
                      </div>
                    </div>
                    <div className={styles.accountActions}>
                    {data?.canManage && <button type="button" className="flowbite-btn flowbite-btn-secondary"
                      disabled={!acc.currency?.isActive} title={!acc.currency?.isActive ? "Activá la moneda en Configuración para registrar movimientos." : undefined}
                      onClick={() => setMovementAccountId(acc.id)} aria-label={`Ingreso o extracción en ${acc.name}, ${curCode}`}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4" /></svg>
                      Ingreso / extracción
                    </button>}
                    <button type="button" className="flowbite-btn flowbite-btn-secondary"
                      aria-label={`Ver historial de ${acc.name}, ${curCode}`} aria-pressed={historyAccount?.id === acc.id}
                      onClick={() => setHistoryAccount({ id: acc.id, name: acc.name })}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2" /></svg>
                      Historial
                    </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tabla de Movimientos */}
          {historyAccount ? <TreasuryHistory key={historyAccount.id} accountId={historyAccount.id} accountName={historyAccount.name} onClose={() => setHistoryAccount(null)} /> : <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ots-text-primary)", letterSpacing: "-0.01em" }}>
                Últimos Movimientos de Cajas
              </h2>
              <span style={{ fontSize: "12px", color: "var(--ots-text-muted)" }}>
                Mostrando {movements.length} movimientos
              </span>
            </div>

            <div className="responsive-table" role="region" aria-label="Movimientos de tesorería" tabIndex={0}>
              <LiquidTableContainer style={{ margin: 0 }}>
                <LiquidTable hover size="md" className="treasury-movement-table">
                  <LiquidTableHead>
                    <LiquidTableRow>
                      <LiquidTableHeaderCell style={{ width: "18%" }}>Fecha</LiquidTableHeaderCell>
                      <LiquidTableHeaderCell style={{ width: "18%" }}>Caja</LiquidTableHeaderCell>
                      <LiquidTableHeaderCell style={{ width: "16%" }}>Operación</LiquidTableHeaderCell>
                      <LiquidTableHeaderCell style={{ width: "30%" }}>Concepto</LiquidTableHeaderCell>
                      <LiquidTableHeaderCell style={{ width: "18%" }} align="right">Monto</LiquidTableHeaderCell>
                    </LiquidTableRow>
                  </LiquidTableHead>
                  <LiquidTableBody>
                    {movements.length === 0 ? (
                      <LiquidTableRow>
                        <LiquidTableCell colSpan={5} align="center" style={{ padding: "32px", color: "var(--ots-text-secondary)" }}>
                          No hay movimientos de tesorería aún.
                        </LiquidTableCell>
                      </LiquidTableRow>
                    ) : (
                      movements.map((mov) => {
                        const isIncome = mov.type === "INCOME";
                        const curCode = mov.account?.currency?.code || "ARS";
                        return (
                          <LiquidTableRow key={mov.id}>
                            <LiquidTableCell style={{ fontSize: "12px", color: "var(--ots-text-secondary)", fontFamily: "var(--ots-font-mono)" }}>
                              {formatDate(mov.date)}
                            </LiquidTableCell>
                            <LiquidTableCell>
                              <span style={{ fontWeight: 600, color: "var(--ots-text-primary)" }}>
                                {mov.account?.name || "Caja"}
                              </span>
                            </LiquidTableCell>
                            <LiquidTableCell>
                              {mov.operation ? (
                                <span className="flowbite-badge flowbite-badge-gray" style={{ fontFamily: "var(--ots-font-mono)" }}>
                                  {mov.operation.operationNumber}
                                </span>
                              ) : (
                                <span style={{ color: "var(--ots-text-muted)", fontSize: "12px" }}>Manual/Ajuste</span>
                              )}
                            </LiquidTableCell>
                            <LiquidTableCell style={{ color: "var(--ots-text-secondary)", fontSize: "13px" }} title={mov.concept}>
                              {mov.concept}
                            </LiquidTableCell>
                            <LiquidTableCell align="right">
                              <span
                                style={{
                                  fontFamily: "var(--ots-font-mono)",
                                  fontWeight: 700,
                                  color: isIncome ? "var(--ots-success)" : "var(--ots-danger)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                {isIncome ? "+" : "-"} {formatNumber(mov.amount, curCode, mov.account?.currency?.decimals ?? 2)}
                              </span>
                            </LiquidTableCell>
                          </LiquidTableRow>
                        );
                      })
                    )}
                  </LiquidTableBody>
                </LiquidTable>
              </LiquidTableContainer>
            </div>
          </div>}
        </>
      )}
      {movementAccountId && <TreasuryMovementDialog accounts={accounts} initialAccountId={movementAccountId} onClose={() => setMovementAccountId(null)}
        onSaved={result => {
          void refreshHistory(key => typeof key === "string" && key.startsWith(`/api/treasury/${result.account.id}/movements`)).catch(() => {});
          void fetchTreasury((current: typeof data) => current ? ({ ...current,
            accounts: current.accounts.map(account => account.id === result.account.id ? result.account : account),
            movements: [result.movement, ...current.movements].slice(0, 100),
          }) : current, { revalidate: false });
        }} />}
      {isTransferOpen && (
        <TreasuryTransferDialog
          accounts={accounts}
          onClose={() => setIsTransferOpen(false)}
          onSaved={() => {
            void fetchTreasury();
            void refreshHistory(key => typeof key === "string" && key.startsWith("/api/treasury/")).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
