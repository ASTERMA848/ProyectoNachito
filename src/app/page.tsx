import prisma from "@/lib/prisma";
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

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    canceled: 0,
  };

  let balances: { currency: string; balance: number }[] = [];
  let contactBalances: { name: string; balances: { currency: string; balance: number }[] }[] = [];

  try {
    const pendingCount = await prisma.operation.count({ where: { state: "PENDING" } });
    const processingCount = await prisma.operation.count({ where: { state: "PROCESSING" } });
    const completedCount = await prisma.operation.count({ where: { state: "COMPLETED" } });
    const canceledCount = await prisma.operation.count({ where: { state: "CANCELED" } });

    stats = {
      pending: pendingCount,
      processing: processingCount,
      completed: completedCount,
      canceled: canceledCount,
    };

    // Agrupar los saldos de cuentas corrientes por moneda
    const accounts = await prisma.account.findMany({
      include: { currency: true, contact: true },
    });

    const balanceMap: Record<string, number> = {};
    for (const acc of accounts) {
      if (!balanceMap[acc.currency.code]) {
        balanceMap[acc.currency.code] = 0;
      }
      balanceMap[acc.currency.code] += acc.balance;
    }

    balances = Object.keys(balanceMap).map((code) => ({
      currency: code,
      balance: balanceMap[code],
    }));

    // Añadir monedas base en cero si no hay cuentas
    const defaultCurrencies = ["USD", "EUR", "ARS"];
    for (const code of defaultCurrencies) {
      if (!balances.find((b) => b.currency === code)) {
        balances.push({ currency: code, balance: 0 });
      }
    }

    // Agrupar saldos por contacto
    const contactBalancesMap: Record<string, { name: string; balances: { currency: string; balance: number }[] }> = {};
    for (const acc of accounts) {
      if (acc.balance === 0) continue; // Opcional: ignorar cuentas en cero
      if (!contactBalancesMap[acc.contactId]) {
        contactBalancesMap[acc.contactId] = {
          name: acc.contact.name,
          balances: [],
        };
      }
      contactBalancesMap[acc.contactId].balances.push({
        currency: acc.currency.code,
        balance: acc.balance,
      });
    }

    contactBalances = Object.values(contactBalancesMap);
  } catch (error) {
    console.error("Error cargando dashboard:", error);
  }

  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0" }}>
      {/* Title */}
      <div style={{ marginBottom: "2rem" }}>
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
          MESA DE CONTROL
        </span>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--ots-text-primary)", letterSpacing: "-0.02em", margin: "2px 0 4px 0" }}>
          Resumen General
        </h1>
      </div>

      {/* Stats Grid: Neo-Fintech Minimal Metric Cards */}
      

      {/* Stats Grid: Neo-Fintech Minimal Metric Cards */}
      <div
        className="dashboard-metrics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {/* Pendientes */}
        <div
          style={{
            backgroundColor: "var(--ots-surface-1)",
            border: "1px solid var(--ots-border)",
            borderRadius: "var(--ots-radius-lg)",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ots-text-secondary)" }}>Pendientes</span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
              Esperando
            </span>
          </div>
          <div style={{ fontFamily: "var(--ots-font-mono)", fontSize: "32px", fontWeight: 700, color: "var(--ots-text-primary)" }}>
            {stats.pending}
          </div>
        </div>

        {/* En Proceso */}
        <div
          style={{
            backgroundColor: "var(--ots-surface-1)",
            border: "1px solid var(--ots-border)",
            borderRadius: "var(--ots-radius-lg)",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ots-text-secondary)" }}>En Proceso</span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
              Activas
            </span>
          </div>
          <div style={{ fontFamily: "var(--ots-font-mono)", fontSize: "32px", fontWeight: 700, color: "var(--ots-text-primary)" }}>
            {stats.processing}
          </div>
        </div>

        {/* Completadas */}
        <div
          style={{
            backgroundColor: "var(--ots-surface-1)",
            border: "1px solid var(--ots-border)",
            borderRadius: "var(--ots-radius-lg)",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ots-text-secondary)" }}>Completadas</span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
              Exitosas
            </span>
          </div>
          <div style={{ fontFamily: "var(--ots-font-mono)", fontSize: "32px", fontWeight: 700, color: "var(--ots-text-primary)" }}>
            {stats.completed}
          </div>
        </div>

        {/* Canceladas */}
        <div
          style={{
            backgroundColor: "var(--ots-surface-1)",
            border: "1px solid var(--ots-border)",
            borderRadius: "var(--ots-radius-lg)",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ots-text-secondary)" }}>Canceladas</span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
              Inactivas
            </span>
          </div>
          <div style={{ fontFamily: "var(--ots-font-mono)", fontSize: "32px", fontWeight: 700, color: "var(--ots-text-primary)" }}>
            {stats.canceled}
          </div>
        </div>
      </div>

      {/* Current Account Balances */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 className="flowbite-section-title">
          Saldos Cuentas Corrientes
        </h2>
        <LiquidTableContainer style={{ margin: 0 }}>
          <LiquidTable hover size="md">
            <LiquidTableHead>
              <LiquidTableRow>
                <LiquidTableHeaderCell style={{ width: "60%" }}>Moneda</LiquidTableHeaderCell>
                <LiquidTableHeaderCell align="right">Saldo Acumulado</LiquidTableHeaderCell>
              </LiquidTableRow>
            </LiquidTableHead>
            <LiquidTableBody>
              {balances.map((b) => (
                <LiquidTableRow key={b.currency}>
                  <LiquidTableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span
                        className={`flowbite-badge ${
                          b.currency === "USD"
                            ? "flowbite-badge-green"
                            : b.currency === "EUR"
                            ? "flowbite-badge-blue"
                            : "flowbite-badge-yellow"
                        }`}
                        style={{ minWidth: "48px", justifyContent: "center" }}
                      >
                        {b.currency}
                      </span>
                      <span style={{ fontWeight: 400 }}>
                        {b.currency === "USD" ? "Dólares" : b.currency === "EUR" ? "Euros" : "Pesos Argentinos"}
                      </span>
                    </div>
                  </LiquidTableCell>
                  <LiquidTableCell align="right" style={{ fontWeight: 600, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "15px" }}>
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: b.currency }).format(b.balance)}
                  </LiquidTableCell>
                </LiquidTableRow>
              ))}
            </LiquidTableBody>
          </LiquidTable>
        </LiquidTableContainer>
      </div>

      {/* Balances by Contact */}
      <div style={{ marginTop: "2rem" }}>
        <h2 className="flowbite-section-title">Saldos por Contacto</h2>
        {contactBalances.length === 0 ? (
          <GlassCard style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)", fontSize: "15px" }}>
            No hay saldos registrados en contactos activos.
          </GlassCard>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
              gap: "1.5rem",
              marginTop: "0.5rem",
            }}
          >
            {contactBalances.map((cb) => (
              <GlassCard key={cb.name} style={{ margin: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <h4 style={{ fontWeight: 600, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", margin: 0, flexWrap: "wrap" }}>
                    {cb.name}
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {cb.balances.map((b) => (
                      <div
                        key={b.currency}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "14.5px",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <span className="flowbite-badge flowbite-badge-gray">{b.currency}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            fontFamily: "var(--font-jetbrains-mono), monospace",
                            fontSize: "14.5px",
                            color: b.balance >= 0 ? "var(--badge-green-text)" : "var(--badge-red-text)",
                            backgroundColor: b.balance >= 0 ? "var(--badge-green-bg)" : "var(--badge-red-bg)",
                            padding: "3px 9px",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          {new Intl.NumberFormat("es-AR", { style: "currency", currency: b.currency }).format(b.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
