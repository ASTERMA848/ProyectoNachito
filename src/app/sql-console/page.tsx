"use client";

import { useState } from "react";
import {
  GlassCard,
  LiquidTableContainer,
  LiquidTable,
  LiquidTableHead,
  LiquidTableBody,
  LiquidTableRow,
  LiquidTableHeaderCell,
  LiquidTableCell,
} from "@liquefy-ui/react";

export default function SqlConsolePage() {
  const [query, setQuery] = useState('SELECT * FROM "Operation" LIMIT 10;');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error ejecutando consulta");
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0" }}>
      {/* Page Title */}
      <div style={{ marginBottom: "1.75rem" }}>
        <span className="section-eyebrow">AUDITORÍA AVANZADA</span>
        <h1 className="flowbite-title">Consola SQL</h1>
        <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
          Herramienta técnica de consulta e inspección de base de datos en tiempo real.
        </p>
      </div>

      {/* Flowbite Alert Box */}
      <div className="flowbite-alert flowbite-alert-info">
        <svg style={{ width: "18px", height: "18px", color: "var(--color-blue-cornflower)", flexShrink: 0, marginTop: "2px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <strong style={{ color: "var(--color-snow)" }}>Consultas de solo lectura habilitadas.</strong> Se admiten comandos <code>SELECT</code>, <code>WITH</code> y afines. Las operaciones destructivas o de alteración de tablas (<code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>, <code>DROP</code>) están estrictamente bloqueadas.
        </div>
      </div>

      {/* Code Editor Container */}
      <GlassCard
        style={{
          padding: 0,
          overflow: "hidden",
          marginBottom: "1.5rem",
        }}
      >
        {/* Code block header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            backgroundColor: "var(--color-deep-coal)",
            borderBottom: "1px solid var(--color-steel-border)",
            fontSize: "12px",
            color: "var(--color-ash)",
            fontFamily: "var(--font-jetbrains-mono)",
          }}
        >
          <span style={{ fontWeight: 500, color: "var(--color-snow)" }}>SQL Terminal</span>
          <span style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.85px", color: "var(--color-blue-cornflower)" }}>Read-Only Mode</span>
        </div>

        {/* Code block textarea */}
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            minHeight: "160px",
            padding: "1.25rem",
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "13px",
            lineHeight: "1.6",
            border: "none",
            backgroundColor: "var(--color-card-carbon)",
            color: "var(--color-snow)",
            resize: "vertical",
            outline: "none",
            display: "block",
          }}
          spellCheck="false"
        />
      </GlassCard>

      {/* Console Action Bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <button
          className="flowbite-btn flowbite-btn-primary"
          onClick={executeQuery}
          disabled={loading}
          style={{ height: "42px", flex: "1 1 auto" }}
        >
          {loading ? "Ejecutando..." : "▶ Ejecutar Consulta"}
        </button>

        <button className="flowbite-btn" disabled={!result} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", height: "42px", flex: "1 1 auto" }}>
          Exportar CSV
        </button>
      </div>

      {/* Error Container */}
      {error && (
        <div
          className="flowbite-badge flowbite-badge-red"
          style={{
            padding: "14px 18px",
            width: "100%",
            borderRadius: "var(--radius-lg)",
            marginBottom: "2rem",
            display: "block",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          <strong>Error de Ejecución:</strong> {error}
        </div>
      )}

      {/* Results Container */}
      {result && (
        <div style={{ marginTop: "2rem" }}>
          <h2 className="flowbite-section-title">
            Resultados de la Consulta ({result.length} filas)
          </h2>
          {result.length > 0 ? (
            <LiquidTableContainer style={{ marginTop: "12px" }}>
              <LiquidTable hover size="md">
                <LiquidTableHead>
                  <LiquidTableRow>
                    {Object.keys(result[0]).map((key) => (
                      <LiquidTableHeaderCell key={key}>
                        {key}
                      </LiquidTableHeaderCell>
                    ))}
                  </LiquidTableRow>
                </LiquidTableHead>
                <LiquidTableBody>
                  {result.map((row: any, i: number) => (
                    <LiquidTableRow key={i}>
                      {Object.values(row).map((val: any, j: number) => (
                        <LiquidTableCell key={j} style={{ fontFamily: "monospace", fontSize: "13px" }}>
                          {val === null ? (
                            <span style={{ color: "var(--text-light)", fontStyle: "italic" }}>null</span>
                          ) : typeof val === "object" ? (
                            JSON.stringify(val)
                          ) : (
                            String(val)
                          )}
                        </LiquidTableCell>
                      ))}
                    </LiquidTableRow>
                  ))}
                </LiquidTableBody>
              </LiquidTable>
            </LiquidTableContainer>
          ) : (
            <div className="flowbite-alert flowbite-alert-info">
              <span></span>
              <div>La consulta se ejecutó con éxito pero no devolvió ninguna fila.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
