"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  LiquidTableContainer,
  LiquidTable,
  LiquidTableHead,
  LiquidTableBody,
  LiquidTableRow,
  LiquidTableHeaderCell,
  LiquidTableCell,
  GlassCard,
} from "@liquefy-ui/react";

function AuditContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get("userId");

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = userId ? `/api/audit?userId=${userId}` : "/api/audit";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.auditLogs || []);
        
        // Si hay un userId filtrado y tenemos registros, buscar el username
        if (userId && data.auditLogs && data.auditLogs.length > 0) {
          const userLog = data.auditLogs.find((l: any) => l.user?.username);
          if (userLog) {
            setTargetUsername(userLog.user.username);
          }
        }
      } else {
        const errData = await res.json();
        setError(errData.error || "Error al cargar logs");
      }
    } catch (e) {
      setError("Error de red al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [userId]);

  const handleClearFilter = () => {
    router.push("/audit");
    setTargetUsername(null);
  };

  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0", overflowX: "hidden" }}>
      {/* Page Header */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem" }}>
        <div>
          <span className="section-eyebrow">SEGURIDAD & COMPLIANCE</span>
          <h1 className="flowbite-title">Logs de Auditoría</h1>
          <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
            Historial inmutable y cronológico de todas las operaciones realizadas en el portal.
          </p>
        </div>
      </div>

      {/* Filter indicator */}
      {userId && (
        <GlassCard
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            marginBottom: "1.5rem",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600 }}>
            Filtrando registros por usuario: <span className="flowbite-badge flowbite-badge-blue">{targetUsername || userId}</span>
          </span>
          <button
            onClick={handleClearFilter}
            className="flowbite-btn flowbite-btn-secondary"
            style={{ padding: "4px 10px", fontSize: "12px", height: "auto" }}
          >
            Ver todos los logs
          </button>
        </GlassCard>
      )}

      {/* Flowbite Alert Box */}
      <div className="flowbite-alert flowbite-alert-info">
        <span style={{ fontSize: "18px" }}>️</span>
        <div>
          <strong>Registro de seguridad inmutable.</strong> Cada acción de creación, edición o consulta es registrada de forma segura para fines de control de auditoría interna y cumplimiento normativo.
        </div>
      </div>

      <h2 className="flowbite-section-title">Base de Datos de Acciones Recientes</h2>

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Cargando registros de auditoría...
        </div>
      ) : error ? (
        <div className="flowbite-alert flowbite-alert-warning">
          <span>️</span>
          <div>{error}</div>
        </div>
      ) : logs.length === 0 ? (
        <GlassCard style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
          No se encontraron registros de auditoría{userId ? " para este usuario" : ""}.
        </GlassCard>
      ) : (
        <>
          {/* Desktop Table (Hidden on Mobile) */}
          <div className="flowbite-desktop-table-container">
            <LiquidTableContainer>
              <LiquidTable hover size="md">
                <LiquidTableHead>
                  <LiquidTableRow>
                    <LiquidTableHeaderCell>Marca Temporal</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Usuario</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Acción</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Entidad</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Detalles (Valores)</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Query / IP</LiquidTableHeaderCell>
                  </LiquidTableRow>
                </LiquidTableHead>
                <LiquidTableBody>
                  {logs.map((log) => {
                    let badgeClass = "flowbite-badge-gray";
                    if (log.action === "CREATE") badgeClass = "flowbite-badge-green";
                    else if (log.action === "UPDATE") badgeClass = "flowbite-badge-yellow";
                    else if (log.action === "DELETE") badgeClass = "flowbite-badge-red";
                    else if (log.action === "LOGIN") badgeClass = "flowbite-badge-purple";
                    else if (log.action === "SQL_QUERY") badgeClass = "flowbite-badge-blue";

                    let details = "";
                    if (log.entity) {
                      details += `${log.entity}`;
                      if (log.entityId) details += ` (${log.entityId.slice(0, 8)}...)`;
                    }
                    if (log.newValues) {
                      try {
                        const parsed = JSON.parse(log.newValues);
                        details += ` - Valores: ${JSON.stringify(parsed)}`;
                      } catch (e) {
                        details += ` - ${log.newValues}`;
                      }
                    } else if (log.oldValues) {
                      try {
                        const parsed = JSON.parse(log.oldValues);
                        details += ` - Anterior: ${JSON.stringify(parsed)}`;
                      } catch (e) {
                        details += ` - ${log.oldValues}`;
                      }
                    }

                    return (
                      <LiquidTableRow key={log.id}>
                        <LiquidTableCell>{new Date(log.createdAt).toLocaleString()}</LiquidTableCell>
                        <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {log.user?.username || "Sistema / Anónimo"}
                        </LiquidTableCell>
                        <LiquidTableCell>
                          <span className={`flowbite-badge ${badgeClass}`}>{log.action}</span>
                        </LiquidTableCell>
                        <LiquidTableCell style={{ fontWeight: 500 }}>{log.entity || "Consola"}</LiquidTableCell>
                        <LiquidTableCell style={{ maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={details}>
                          {details || "N/A"}
                        </LiquidTableCell>
                        <LiquidTableCell style={{ fontFamily: "monospace", fontSize: "12px", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.query || log.ipAddress || "N/A"}>
                          {log.query || log.ipAddress || "N/A"}
                        </LiquidTableCell>
                      </LiquidTableRow>
                    );
                  })}
                </LiquidTableBody>
              </LiquidTable>
            </LiquidTableContainer>
          </div>

          {/* Mobile Cards List (Only shown on mobile) */}
          <div className="flowbite-mobile-card-list">
            {logs.map((log) => {
              let badgeClass = "flowbite-badge-gray";
              if (log.action === "CREATE") badgeClass = "flowbite-badge-green";
              else if (log.action === "UPDATE") badgeClass = "flowbite-badge-yellow";
              else if (log.action === "DELETE") badgeClass = "flowbite-badge-red";
              else if (log.action === "LOGIN") badgeClass = "flowbite-badge-purple";
              else if (log.action === "SQL_QUERY") badgeClass = "flowbite-badge-blue";

              let details = "";
              if (log.entity) {
                details += `${log.entity}`;
                if (log.entityId) details += ` (${log.entityId.slice(0, 8)}...)`;
              }
              if (log.newValues) {
                try {
                  const parsed = JSON.parse(log.newValues);
                  details += ` - Valores: ${JSON.stringify(parsed)}`;
                } catch (e) {
                  details += ` - ${log.newValues}`;
                }
              } else if (log.oldValues) {
                try {
                  const parsed = JSON.parse(log.oldValues);
                  details += ` - Anterior: ${JSON.stringify(parsed)}`;
                } catch (e) {
                  details += ` - ${log.oldValues}`;
                }
              }

              return (
              <GlassCard
                  key={log.id}
                  style={{
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <span className={`flowbite-badge ${badgeClass}`}>{log.action}</span>
                  </div>
                  <div style={{ fontSize: "13px" }}>
                    <div>
                      <strong style={{ color: "var(--text-secondary)" }}>Usuario: </strong>
                      <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                        {log.user?.username || "Sistema / Anónimo"}
                      </span>
                    </div>
                    {log.entity && (
                      <div style={{ marginTop: "4px" }}>
                        <strong style={{ color: "var(--text-secondary)" }}>Entidad: </strong>
                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{log.entity}</span>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      backgroundColor: "var(--hover-bg)",
                      padding: "8px",
                      borderRadius: "var(--radius-md)",
                      wordBreak: "break-all",
                      maxHeight: "100px",
                      overflowY: "auto",
                    }}
                  >
                    <strong style={{ color: "var(--text-secondary)" }}>Detalles: </strong>
                    <span style={{ color: "var(--text-primary)" }}>{details || "N/A"}</span>
                  </div>
                  {(log.query || log.ipAddress) && (
                    <div style={{ fontSize: "11px", color: "var(--text-light)", fontFamily: "monospace", borderTop: "1px solid var(--border-color)", paddingTop: "6px" }}>
                      {log.query ? `Query: ${log.query}` : `IP: ${log.ipAddress}`}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div style={{ padding: "3rem", textAlign: "center" }}>Cargando módulo de auditoría...</div>}>
      <AuditContent />
    </Suspense>
  );
}
