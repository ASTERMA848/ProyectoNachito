"use client";

import { GlassCard } from "@liquefy-ui/react";

export default function ReportsPage() {
  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <span className="section-eyebrow">ANÁLISIS & EXPORTACIÓN</span>
        <h1 className="flowbite-title">Centro de Reportes</h1>
        <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
          Generación de reportes de auditoría contable y estados de cuenta consolidados.
        </p>
      </div>

      {/* Flowbite Alert Box */}
      <div className="flowbite-alert flowbite-alert-info">
        <span style={{ fontSize: "18px" }}></span>
        <div>
          Selecciona una plantilla para exportar los datos en el formato deseado (PDF, Excel, CSV). Los filtros avanzados e intervalos de fechas se pueden personalizar antes de procesar el archivo.
        </div>
      </div>

      <h2 className="flowbite-section-title">Plantillas de Reportes</h2>

      <div className="flowbite-grid-2">
        {/* Report card 1 */}
        <GlassCard style={{ margin: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "space-between", height: "100%" }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", marginBottom: "6px" }}>Estado de Cuenta de Contactos</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                Historial completo de débitos, créditos y saldos acumulados de clientes o proveedores para un período determinado.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button className="flowbite-btn flowbite-btn-primary" style={{ flex: 1 }}>Descargar PDF</button>
              <button className="flowbite-btn" style={{ padding: "8px 12px" }}>CSV</button>
            </div>
          </div>
        </GlassCard>

        {/* Report card 2 */}
        <GlassCard style={{ margin: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "space-between", height: "100%" }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", marginBottom: "6px" }}>🪙 Arqueo y Cierre de Caja</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                Consolidación de entradas, salidas y transferencias en efectivo o cuentas bancarias durante el turno operativo actual.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button className="flowbite-btn flowbite-btn-primary" style={{ flex: 1 }}>Cerrar y Exportar</button>
              <button className="flowbite-btn" style={{ padding: "8px 12px" }}>Excel</button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
