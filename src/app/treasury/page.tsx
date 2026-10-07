"use client";

import { useState } from "react";
import useSWR from "swr";
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

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TreasuryPage() {
  const { data, isLoading: loading, mutate: fetchTreasury } = useSWR("/api/treasury", fetcher);

  const accounts = data?.accounts || [];
  const movements = data?.movements || [];

  const formatNumber = (val: number | undefined | null, currencyCode: string) => {
    const num = typeof val === "number" ? val : 0;
    try {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${currencyCode} ${num.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
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
        <button
          type="button"
          onClick={fetchTreasury}
          className="flowbite-btn flowbite-btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
          Actualizar
        </button>
      </div>

      {/* Cajas (Cards de Cuentas de Tesorería) */}
      {loading ? (
        <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--ots-text-secondary)", fontSize: "14px" }}>Cargando cajas de tesorería...</span>
        </div>
      ) : (
        <>
          {accounts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: "var(--ots-text-secondary)", backgroundColor: "var(--ots-surface-1)", borderRadius: "var(--ots-radius-lg)", border: "1px solid var(--ots-border)", marginBottom: "2rem" }}>
              No hay cajas registradas aún. Las cajas se crean automáticamente al cobrar o pagar operaciones.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: "1.25rem",
                marginBottom: "2.5rem",
              }}
            >
              {accounts.map((acc) => {
                const isPositive = (acc.balance || 0) >= 0;
                const curCode = acc.currency?.code || "ARS";
                const curColor = acc.currency?.color || "#3b82f6";
                return (
                  <div
                    key={acc.id}
                    style={{
                      backgroundColor: "var(--ots-surface-1)",
                      border: "1px solid var(--ots-border)",
                      borderRadius: "var(--ots-radius-lg)",
                      padding: "20px 24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "16px",
                      boxShadow: "var(--ots-shadow-sm)",
                      transition: "transform 150ms ease, box-shadow 150ms ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ots-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                        {curCode}
                      </span>
                    </div>
                    
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--ots-text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Saldo Disponible
                      </span>
                      <div
                        style={{
                          fontFamily: "var(--ots-font-mono)",
                          fontSize: "26px",
                          fontWeight: 700,
                          color: isPositive ? "var(--ots-text-primary)" : "var(--ots-danger)",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {formatNumber(acc.balance, curCode)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tabla de Movimientos */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ots-text-primary)", letterSpacing: "-0.01em" }}>
                Últimos Movimientos de Cajas
              </h2>
              <span style={{ fontSize: "12px", color: "var(--ots-text-muted)" }}>
                Mostrando {movements.length} movimientos
              </span>
            </div>

            <div className="flowbite-desktop-table-container" style={{ overflowX: "auto", width: "100%" }}>
              <LiquidTableContainer style={{ margin: 0 }}>
                <LiquidTable hover size="md">
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
                                {isIncome ? "+" : "-"} {formatNumber(mov.amount, curCode)}
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
          </div>
        </>
      )}
    </div>
  );
}

