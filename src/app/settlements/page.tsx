"use client";

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

export default function SettlementsPage() {
  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0" }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <span className="section-eyebrow">ESTADOS DE CUENTA & COBROS</span>
        <h1 className="flowbite-title">Liquidaciones a Proveedores</h1>
        <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
          Control de liquidaciones vencidas, devengadas y pendientes de cobro/pago.
        </p>
      </div>

      {/* Flowbite Alert Box */}
      <div className="flowbite-alert flowbite-alert-info">
        <span style={{ fontSize: "18px" }}>️</span>
        <div>
          <strong>Módulo de liquidaciones automáticas en desarrollo.</strong> Esta sección simula la base de datos de liquidaciones consolidadas para cada proveedor. Próximamente se integrarán pagos parciales directamente desde las cajas de tesorería.
        </div>
      </div>

      <h2 className="flowbite-section-title">Base de Datos de Liquidaciones</h2>
      
      <div className="flowbite-desktop-table-container">
        <LiquidTableContainer>
          <LiquidTable hover size="md">
            <LiquidTableHead>
              <LiquidTableRow>
                <LiquidTableHeaderCell>Proveedor</LiquidTableHeaderCell>
                <LiquidTableHeaderCell>Operación Ref</LiquidTableHeaderCell>
                <LiquidTableHeaderCell>Vencimiento</LiquidTableHeaderCell>
                <LiquidTableHeaderCell align="right">Monto Liquidación</LiquidTableHeaderCell>
                <LiquidTableHeaderCell align="right">Monto Pagado</LiquidTableHeaderCell>
                <LiquidTableHeaderCell>Estado</LiquidTableHeaderCell>
              </LiquidTableRow>
            </LiquidTableHead>
            <LiquidTableBody>
              <LiquidTableRow>
                <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>Juan Pérez (Proveedor)</LiquidTableCell>
                <LiquidTableCell style={{ fontWeight: 500 }}>OP-000104</LiquidTableCell>
                <LiquidTableCell>15/06/2026</LiquidTableCell>
                <LiquidTableCell align="right" style={{ fontFamily: "monospace", fontWeight: 600 }}>$5.000,00 USD</LiquidTableCell>
                <LiquidTableCell align="right" style={{ fontFamily: "monospace", fontWeight: 600 }}>$5.000,00 USD</LiquidTableCell>
                <LiquidTableCell><span className="flowbite-badge flowbite-badge-green">Liquidado</span></LiquidTableCell>
              </LiquidTableRow>
              <LiquidTableRow>
                <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>Cambiaria S.A.</LiquidTableCell>
                <LiquidTableCell style={{ fontWeight: 500 }}>OP-000108</LiquidTableCell>
                <LiquidTableCell>20/06/2026</LiquidTableCell>
                <LiquidTableCell align="right" style={{ fontFamily: "monospace", fontWeight: 600 }}>$1.200.000,00 ARS</LiquidTableCell>
                <LiquidTableCell align="right" style={{ fontFamily: "monospace", fontWeight: 600 }}>$400.000,00 ARS</LiquidTableCell>
                <LiquidTableCell><span className="flowbite-badge flowbite-badge-yellow">Pago Parcial</span></LiquidTableCell>
              </LiquidTableRow>
              <LiquidTableRow>
                <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>María Rodríguez (Broker)</LiquidTableCell>
                <LiquidTableCell style={{ fontWeight: 500 }}>OP-000109</LiquidTableCell>
                <LiquidTableCell>12/06/2026</LiquidTableCell>
                <LiquidTableCell align="right" style={{ fontFamily: "monospace", fontWeight: 600 }}>$3.500,00 EUR</LiquidTableCell>
                <LiquidTableCell align="right" style={{ fontFamily: "monospace", fontWeight: 600 }}>$0,00 EUR</LiquidTableCell>
                <LiquidTableCell><span className="flowbite-badge flowbite-badge-red">Vencido</span></LiquidTableCell>
              </LiquidTableRow>
            </LiquidTableBody>
          </LiquidTable>
        </LiquidTableContainer>
      </div>

      {/* Mobile Cards List (Only shown on mobile) */}
      <div className="flowbite-mobile-card-list">
        {/* Card 1 */}
        <GlassCard
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            borderLeft: "4px solid var(--badge-green-text)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                Juan Pérez (Proveedor)
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Ref: OP-000104 | Vto: 15/06/2026
              </span>
            </div>
            <span className="flowbite-badge flowbite-badge-green">Liquidado</span>
          </div>
          <div className="flowbite-grid-2" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "8px", gap: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Monto Liq.</div>
              <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>$5.000,00 USD</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Monto Pagado</div>
              <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "14px", color: "var(--badge-green-text)" }}>$5.000,00 USD</div>
            </div>
          </div>
        </GlassCard>

        {/* Card 2 */}
        <GlassCard
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            borderLeft: "4px solid var(--badge-yellow-text)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                Cambiaria S.A.
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Ref: OP-000108 | Vto: 20/06/2026
              </span>
            </div>
            <span className="flowbite-badge flowbite-badge-yellow">Pago Parcial</span>
          </div>
          <div className="flowbite-grid-2" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "8px", gap: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Monto Liq.</div>
              <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>$1.200.000,00 ARS</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Monto Pagado</div>
              <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "14px", color: "var(--badge-yellow-text)" }}>$400.000,00 ARS</div>
            </div>
          </div>
        </GlassCard>

        {/* Card 3 */}
        <GlassCard
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            borderLeft: "4px solid var(--badge-red-text)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                María Rodríguez (Broker)
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Ref: OP-000109 | Vto: 12/06/2026
              </span>
            </div>
            <span className="flowbite-badge flowbite-badge-red">Vencido</span>
          </div>
          <div className="flowbite-grid-2" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "8px", gap: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Monto Liq.</div>
              <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>$3.500,00 EUR</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Monto Pagado</div>
              <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "14px", color: "var(--badge-red-text)" }}>$0,00 EUR</div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
