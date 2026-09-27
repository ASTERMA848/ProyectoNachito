"use client";

import { useEffect, useState, useMemo } from "react";
import Portal from "@/components/Portal";
import LiquidSelect from "@/components/LiquidSelect";
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

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface TreasuryAccount {
  id: string;
  name: string;
  type: "CASH" | "BANK" | "WALLET";
  currencyId: string;
  balance: number;
  isActive: boolean;
  currency: Currency;
  _count?: { movements: number };
}

interface TreasuryMovement {
  id: string;
  accountId: string;
  date: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  amount: number;
  concept: string;
  reference: string | null;
  account: {
    name: string;
    type: string;
    currency: Currency;
  };
}

export default function TreasuryPage() {
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [movements, setMovements] = useState<TreasuryMovement[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtros
  const [selectedAccountId, setSelectedAccountId] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  // Modales
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Form State: Registrar Movimiento
  const [movForm, setMovForm] = useState({
    accountId: "",
    type: "INCOME",
    amount: "",
    concept: "",
    reference: "",
    date: new Date().toISOString().slice(0, 16),
  });

  // Form State: Transferencia
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    concept: "",
    reference: "",
    date: new Date().toISOString().slice(0, 16),
  });

  // Form State: Nueva Cuenta
  const [accountForm, setAccountForm] = useState({
    name: "",
    type: "CASH",
    currencyId: "",
    initialBalance: "",
  });

  // Cargar datos principales
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [accRes, movRes, currRes] = await Promise.all([
        fetch("/api/treasury/accounts"),
        fetch("/api/treasury/movements?limit=150"),
        fetch("/api/currencies"),
      ]);

      if (accRes.ok) {
        const accData = await accRes.json();
        setAccounts(accData.accounts || []);
      }
      if (movRes.ok) {
        const movData = await movRes.json();
        setMovements(movData.movements || []);
      }
      if (currRes.ok) {
        const currData = await currRes.json();
        setCurrencies(currData.currencies || []);
        if (currData.currencies?.length > 0 && !accountForm.currencyId) {
          setAccountForm((prev) => ({ ...prev, currencyId: currData.currencies[0].id }));
        }
      }
    } catch (err: any) {
      console.error("Error al cargar tesorería:", err);
      setError("No se pudieron cargar los datos de tesorería.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Crear Movimiento
  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movForm.accountId || !movForm.amount || !movForm.concept) {
      alert("Por favor complete todos los campos requeridos.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/treasury/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar movimiento");

      showNotification("Movimiento registrado con éxito.");
      setIsMovementModalOpen(false);
      setMovForm({
        accountId: accounts[0]?.id || "",
        type: "INCOME",
        amount: "",
        concept: "",
        reference: "",
        date: new Date().toISOString().slice(0, 16),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Transferencia Interna
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) {
      alert("Por favor complete los campos obligatorios.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/treasury/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al realizar la transferencia");

      showNotification("Transferencia completada correctamente.");
      setIsTransferModalOpen(false);
      setTransferForm({
        fromAccountId: "",
        toAccountId: "",
        amount: "",
        concept: "",
        reference: "",
        date: new Date().toISOString().slice(0, 16),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Crear Nueva Cuenta
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name || !accountForm.currencyId) {
      alert("Por favor complete el nombre y la moneda.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/treasury/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la cuenta");

      showNotification("Cuenta de tesorería creada exitosamente.");
      setIsAccountModalOpen(false);
      setAccountForm({
        name: "",
        type: "CASH",
        currencyId: currencies[0]?.id || "",
        initialBalance: "",
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtrado de movimientos
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      // Filtro por cuenta
      if (selectedAccountId !== "ALL" && mov.accountId !== selectedAccountId) {
        return false;
      }
      // Filtro por tipo
      if (typeFilter !== "ALL" && mov.type !== typeFilter) {
        return false;
      }
      // Filtro por fecha desde
      if (startDate) {
        const movDate = new Date(mov.date).toISOString().split("T")[0];
        if (movDate < startDate) return false;
      }
      // Filtro por fecha hasta
      if (endDate) {
        const movDate = new Date(mov.date).toISOString().split("T")[0];
        if (movDate > endDate) return false;
      }
      // Búsqueda por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inConcept = mov.concept.toLowerCase().includes(q);
        const inRef = mov.reference ? mov.reference.toLowerCase().includes(q) : false;
        const inAcc = mov.account.name.toLowerCase().includes(q);
        if (!inConcept && !inRef && !inAcc) return false;
      }
      return true;
    });
  }, [movements, selectedAccountId, typeFilter, searchQuery, startDate, endDate]);

  // Consolidado de liquidez por moneda
  const totalsByCurrency = useMemo(() => {
    const map: Record<string, { total: number; symbol: string }> = {};
    accounts.forEach((acc) => {
      const code = acc.currency.code;
      if (!map[code]) {
        map[code] = { total: 0, symbol: acc.currency.symbol };
      }
      map[code].total += acc.balance;
    });
    return Object.entries(map).map(([code, data]) => ({
      code,
      total: data.total,
      symbol: data.symbol,
    }));
  }, [accounts]);

  // Auxiliares de formato
  const formatAmount = (num: number, code: string, symbol: string) => {
    const formatted = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    return `${symbol} ${formatted} ${code}`;
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "CASH":
        return { label: "Efectivo", badge: "flowbite-badge-green" };
      case "BANK":
        return { label: "Banco", badge: "flowbite-badge-blue" };
      case "WALLET":
        return { label: "Cripto", badge: "flowbite-badge-purple" };
      default:
        return { label: type, badge: "flowbite-badge-gray" };
    }
  };

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case "INCOME":
        return { label: "Ingreso", badge: "flowbite-badge-green" };
      case "EXPENSE":
        return { label: "Egreso", badge: "flowbite-badge-red" };
      case "TRANSFER":
        return { label: "Transferencia", badge: "flowbite-badge-blue" };
      case "ADJUSTMENT":
        return { label: "Ajuste", badge: "flowbite-badge-yellow" };
      default:
        return { label: type, badge: "flowbite-badge-gray" };
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0", overflowX: "hidden" }}>
      {/* Notificación temporal */}
      {successMsg && (
        <div
          className="flowbite-alert"
          style={{
            backgroundColor: "rgba(52, 211, 153, 0.15)",
            border: "1px solid rgba(52, 211, 153, 0.3)",
            color: "#34d399",
            position: "fixed",
            top: "70px",
            right: "24px",
            zIndex: 1000,
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          }}
        >
          <span>✓ {successMsg}</span>
        </div>
      )}

      {/* Header Principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="section-eyebrow">CAJAS & BANCARIZACIÓN</span>
          <h1 className="flowbite-title">Tesorería</h1>
          <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
            Gestión centralizada de cajas físicas, cuentas bancarias y billeteras de criptomonedas.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setIsAccountModalOpen(true)}
            className="flowbite-btn"
            style={{ fontSize: "13px" }}
          >
            + Nueva Cuenta
          </button>
          <button
            onClick={() => {
              if (accounts.length < 2) {
                alert("Se requieren al menos 2 cuentas para realizar una transferencia.");
                return;
              }
              setTransferForm((prev) => ({
                ...prev,
                fromAccountId: accounts[0]?.id || "",
                toAccountId: accounts[1]?.id || "",
              }));
              setIsTransferModalOpen(true);
            }}
            className="flowbite-btn"
            style={{ fontSize: "13px" }}
          >
            ⇄ Transferir
          </button>
          <button
            onClick={() => {
              if (accounts.length === 0) {
                alert("Debe crear al menos una cuenta de tesorería primero.");
                return;
              }
              setMovForm((prev) => ({
                ...prev,
                accountId: selectedAccountId !== "ALL" ? selectedAccountId : accounts[0]?.id || "",
              }));
              setIsMovementModalOpen(true);
            }}
            className="flowbite-btn flowbite-btn-primary"
            style={{ fontSize: "13px" }}
          >
            + Registrar Movimiento
          </button>
        </div>
      </div>

      {/* Banner de Consolidado de Liquidez Total */}
      {totalsByCurrency.length > 0 && (
        <GlassCard
          style={{
            padding: "16px 20px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>💼</span>
            <div>
              <div style={{ fontSize: "12.5px", fontFamily: "var(--font-manrope), sans-serif", fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Liquidez Total Consolidada
              </div>
              <div style={{ fontSize: "14px", color: "var(--color-snow)" }}>
                Suma acumulada de todas las cuentas activas
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {totalsByCurrency.map((item) => (
              <div
                key={item.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-card-carbon)",
                  border: "1px solid var(--color-steel-border)",
                }}
              >
                <span className="flowbite-badge flowbite-badge-blue">{item.code}</span>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 600, fontSize: "15px", color: "var(--color-snow)" }}>
                  {item.symbol} {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 }).format(item.total)}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Tarjetas de Cuentas y Cajas de Tesorería */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 className="flowbite-section-title" style={{ margin: 0 }}>
            Cuentas y Cajas ({accounts.length})
          </h2>
          {selectedAccountId !== "ALL" && (
            <button
              onClick={() => setSelectedAccountId("ALL")}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-blue-cornflower)",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "var(--font-jetbrains-mono)",
              }}
            >
              ✕ Quitar filtro de cuenta
            </button>
          )}
        </div>

        {loading ? (
          <GlassCard style={{ textAlign: "center", color: "var(--color-ash)", padding: "2rem" }}>
            Cargando cuentas de tesorería...
          </GlassCard>
        ) : accounts.length === 0 ? (
          <GlassCard style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ color: "var(--color-ash)", marginBottom: "12px" }}>No hay cuentas de tesorería registradas.</p>
            <button onClick={() => setIsAccountModalOpen(true)} className="flowbite-btn flowbite-btn-primary">
              Crear primera cuenta
            </button>
          </GlassCard>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: "1rem",
            }}
          >
            {accounts.map((acc) => {
              const typeInfo = getAccountTypeLabel(acc.type);
              const isSelected = selectedAccountId === acc.id;
              return (
                <GlassCard
                  key={acc.id}
                  onClick={() => setSelectedAccountId(isSelected ? "ALL" : acc.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    margin: 0,
                    cursor: "pointer",
                    padding: "20px",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--color-snow)" }}>
                      {acc.name}
                    </span>
                    <span className={`flowbite-badge ${typeInfo.badge}`}>{typeInfo.label}</span>
                  </div>

                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: 600,
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: acc.balance >= 0 ? "var(--color-snow)" : "var(--badge-red-text)",
                      letterSpacing: "-0.5px",
                      margin: "6px 0",
                      lineHeight: 1.15,
                    }}
                  >
                    {formatAmount(acc.balance, acc.currency.code, acc.currency.symbol)}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px", color: "var(--text-secondary)" }}>
                    <span>{acc._count?.movements || 0} movimientos</span>
                    <span style={{ color: isSelected ? "var(--color-blue-cornflower)" : "var(--text-light)", fontSize: "12px", fontWeight: 500 }}>
                      {isSelected ? "● Filtrando movimientos" : "Click para filtrar"}
                    </span>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial de Movimientos de Tesorería */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 className="flowbite-section-title" style={{ margin: 0 }}>
              Movimientos de Tesorería
            </h2>
            <p style={{ color: "var(--color-ash)", fontSize: "13px" }}>
              Registro cronológico de ingresos, egresos y transferencias entre cajas.
            </p>
          </div>
        </div>

        {/* Barra de Filtros Completa y Expandible */}
        <div className="flowbite-table-header flowbite-table-header-stacked" style={{ marginBottom: "16px", position: "relative", zIndex: 30 }}>
          {/* Top Controls Bar */}
          <div className="flowbite-table-header-top">
            {/* Left side: Search & Filter Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", maxWidth: "520px" }}>
              <div className="flowbite-search-container" style={{ margin: 0, flex: 1, position: "relative" }}>
                <svg className="flowbite-search-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar concepto, ref o caja..."
                  className="flowbite-search-input"
                />
              </div>

              {/* Botón Filtros Avanzados */}
              <button
                type="button"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className="flowbite-btn"
                style={{
                  padding: "9px 14px",
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  whiteSpace: "nowrap",
                  background: (isFiltersOpen || typeFilter !== "ALL" || selectedAccountId !== "ALL" || startDate || endDate)
                    ? "rgba(103, 152, 255, 0.2)"
                    : "rgba(255, 255, 255, 0.08)",
                  borderColor: (isFiltersOpen || typeFilter !== "ALL" || selectedAccountId !== "ALL" || startDate || endDate)
                    ? "rgba(103, 152, 255, 0.55)"
                    : "rgba(255, 255, 255, 0.22)",
                  color: (isFiltersOpen || typeFilter !== "ALL" || selectedAccountId !== "ALL" || startDate || endDate)
                    ? "#ffffff"
                    : "rgba(255, 255, 255, 0.8)",
                  boxShadow: (typeFilter !== "ALL" || selectedAccountId !== "ALL" || startDate || endDate)
                    ? "0 0 14px rgba(103, 152, 255, 0.3)"
                    : undefined
                }}
                title="Filtros avanzados por fecha, tipo y caja"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ width: "15px", height: "15px" }}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Filtros</span>
                {(typeFilter !== "ALL" || selectedAccountId !== "ALL" || startDate || endDate) && (
                  <span
                    style={{
                      background: "var(--primary-color)",
                      color: "#080c1d",
                      borderRadius: "10px",
                      padding: "1px 6px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {[
                      typeFilter !== "ALL" ? 1 : 0,
                      selectedAccountId !== "ALL" ? 1 : 0,
                      startDate || endDate ? 1 : 0
                    ].reduce((a, b) => a + b, 0)}
                  </span>
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    width: "12px",
                    height: "12px",
                    transition: "transform 0.2s",
                    transform: isFiltersOpen ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Quick Tipo Filter Tabs on the right when filter panel is collapsed */}
            {!isFiltersOpen && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                {[
                  { id: "ALL", label: "Todos" },
                  { id: "INCOME", label: "Ingresos" },
                  { id: "EXPENSE", label: "Egresos" },
                  { id: "TRANSFER", label: "Transferencias" },
                  { id: "ADJUSTMENT", label: "Ajustes" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTypeFilter(tab.id)}
                    className="flowbite-btn"
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      backgroundColor: typeFilter === tab.id ? "rgba(103, 152, 255, 0.25)" : "rgba(255, 255, 255, 0.06)",
                      color: typeFilter === tab.id ? "#ffffff" : "var(--color-ash)",
                      borderColor: typeFilter === tab.id ? "rgba(103, 152, 255, 0.6)" : "rgba(255, 255, 255, 0.16)",
                      fontWeight: typeFilter === tab.id ? 600 : 500,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Panel Desplegable de Filtros (Expansión Limpia en el Flujo - Sin Superposición) */}
          {isFiltersOpen && (
            <div className="flowbite-filter-panel">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  gap: "20px",
                  justifyContent: "space-between"
                }}
              >
                {/* Sección: Tipo de Movimiento */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255, 255, 255, 0.75)", letterSpacing: "0.5px" }}>
                    FILTRAR POR TIPO
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("ALL")}
                      className={`flowbite-badge ${typeFilter === "ALL" ? "flowbite-badge-blue" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("INCOME")}
                      className={`flowbite-badge ${typeFilter === "INCOME" ? "flowbite-badge-green" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Ingresos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("EXPENSE")}
                      className={`flowbite-badge ${typeFilter === "EXPENSE" ? "flowbite-badge-red" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Egresos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("TRANSFER")}
                      className={`flowbite-badge ${typeFilter === "TRANSFER" ? "flowbite-badge-indigo" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Transferencias
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("ADJUSTMENT")}
                      className={`flowbite-badge ${typeFilter === "ADJUSTMENT" ? "flowbite-badge-yellow" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Ajustes
                    </button>
                  </div>
                </div>

                {/* Sección: Cuenta / Caja */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 240px", maxWidth: "300px", width: "100%" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255, 255, 255, 0.75)", letterSpacing: "0.5px" }}>
                    FILTRAR POR CUENTA / CAJA
                  </span>
                  <LiquidSelect
                    value={selectedAccountId}
                    onChange={(val) => setSelectedAccountId(val)}
                    options={[
                      { value: "ALL", label: "Todas las cuentas y cajas" },
                      ...accounts.map((acc) => ({
                        value: acc.id,
                        label: `${acc.name} (${acc.currency.code})`,
                        sublabel: `${acc.type === "CASH" ? "Caja de efectivo" : acc.type === "BANK" ? "Cuenta bancaria" : "Billetera digital"}`
                      }))
                    ]}
                  />
                </div>

                {/* Sección: Rango de Fechas */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 340px", maxWidth: "480px", width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255, 255, 255, 0.75)", letterSpacing: "0.5px" }}>
                      FILTRAR POR FECHA
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const todayStr = new Date().toISOString().split("T")[0];
                          setStartDate(todayStr);
                          setEndDate(todayStr);
                        }}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.16)",
                          borderRadius: "var(--radius-pill)",
                          color: "var(--primary-color)",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "2px 8px"
                        }}
                      >
                        📅 Hoy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
                          setStartDate(firstDay);
                          setEndDate(lastDay);
                        }}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.16)",
                          borderRadius: "var(--radius-pill)",
                          color: "rgba(255, 255, 255, 0.8)",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "2px 8px"
                        }}
                      >
                        Este mes
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <label className="flowbite-form-label" style={{ fontSize: "11px", marginBottom: "3px" }}>Desde:</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="flowbite-input"
                        style={{ padding: "7px 10px", fontSize: "12.5px" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="flowbite-form-label" style={{ fontSize: "11px", marginBottom: "3px" }}>Hasta:</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="flowbite-input"
                        style={{ padding: "7px 10px", fontSize: "12.5px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Acciones del panel de filtro */}
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                  {(typeFilter !== "ALL" || selectedAccountId !== "ALL" || startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTypeFilter("ALL");
                        setSelectedAccountId("ALL");
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="flowbite-btn flowbite-btn-text"
                      style={{ padding: "7px 12px", fontSize: "12px", color: "rgba(255, 255, 255, 0.75)" }}
                    >
                      Limpiar filtros
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen(false)}
                    className="flowbite-btn"
                    style={{ padding: "7px 14px", fontSize: "12px" }}
                  >
                    Ocultar
                  </button>
                </div>
              </div>

              {/* Resumen de filtros activos con botón remover */}
              {(typeFilter !== "ALL" || selectedAccountId !== "ALL" || startDate || endDate) && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", fontSize: "12px", color: "rgba(255, 255, 255, 0.7)", paddingTop: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600 }}>Filtros activos:</span>
                  {typeFilter !== "ALL" && (
                    <span className="flowbite-badge flowbite-badge-blue" style={{ fontSize: "11px", padding: "2px 8px" }}>
                      Tipo: {typeFilter === "INCOME" ? "Ingresos" : typeFilter === "EXPENSE" ? "Egresos" : typeFilter === "TRANSFER" ? "Transferencias" : "Ajustes"}
                      <button onClick={() => setTypeFilter("ALL")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", marginLeft: "4px", padding: 0 }}>×</button>
                    </span>
                  )}
                  {selectedAccountId !== "ALL" && (
                    <span className="flowbite-badge flowbite-badge-yellow" style={{ fontSize: "11px", padding: "2px 8px" }}>
                      Caja: {accounts.find((a) => a.id === selectedAccountId)?.name || "Seleccionada"}
                      <button onClick={() => setSelectedAccountId("ALL")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", marginLeft: "4px", padding: 0 }}>×</button>
                    </span>
                  )}
                  {startDate && (
                    <span className="flowbite-badge flowbite-badge-purple" style={{ fontSize: "11px", padding: "2px 8px" }}>
                      Desde: {startDate}
                      <button onClick={() => setStartDate("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", marginLeft: "4px", padding: 0 }}>×</button>
                    </span>
                  )}
                  {endDate && (
                    <span className="flowbite-badge flowbite-badge-purple" style={{ fontSize: "11px", padding: "2px 8px" }}>
                      Hasta: {endDate}
                      <button onClick={() => setEndDate("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", marginLeft: "4px", padding: 0 }}>×</button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabla de Movimientos */}
        <div className="flowbite-desktop-table-container">
          <LiquidTableContainer>
            <LiquidTable hover size="md">
              <LiquidTableHead>
                <LiquidTableRow>
                  <LiquidTableHeaderCell style={{ width: "16%" }}>Fecha / Hora</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "20%" }}>Cuenta / Caja</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "12%" }}>Tipo</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "32%" }}>Concepto / Referencia</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "20%" }} align="right">Monto</LiquidTableHeaderCell>
                </LiquidTableRow>
              </LiquidTableHead>
              <LiquidTableBody>
                {filteredMovements.length === 0 ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={5} align="center" style={{ padding: "2.5rem", color: "var(--color-ash)" }}>
                      No se encontraron movimientos registrados con los filtros seleccionados.
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : (
                  filteredMovements.map((mov) => {
                    const typeBadge = getMovementTypeBadge(mov.type);
                    const isPositive = mov.type === "INCOME" || (mov.type === "ADJUSTMENT" && mov.amount >= 0);
                    const isNegative = mov.type === "EXPENSE";

                    return (
                      <LiquidTableRow key={mov.id}>
                        <LiquidTableCell style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "12px", color: "var(--color-ash)" }}>
                          {new Date(mov.date).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </LiquidTableCell>
                        <LiquidTableCell>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, color: "var(--color-snow)" }}>{mov.account.name}</span>
                            <span className="flowbite-badge flowbite-badge-gray" style={{ fontSize: "10px" }}>
                              {mov.account.currency.code}
                            </span>
                          </div>
                        </LiquidTableCell>
                        <LiquidTableCell>
                          <span className={`flowbite-badge ${typeBadge.badge}`}>{typeBadge.label}</span>
                        </LiquidTableCell>
                        <LiquidTableCell>
                          <div>
                            <span style={{ color: "var(--color-snow)", display: "block" }}>{mov.concept}</span>
                            {mov.reference && (
                              <span style={{ fontSize: "11px", color: "var(--color-ash)", fontFamily: "var(--font-jetbrains-mono)" }}>
                                Ref: {mov.reference}
                              </span>
                            )}
                          </div>
                        </LiquidTableCell>
                        <LiquidTableCell align="right">
                          <span
                            style={{
                              fontFamily: "var(--font-jetbrains-mono)",
                              fontWeight: 600,
                              fontSize: "13px",
                              color: isPositive
                                ? "var(--badge-green-text)"
                                : isNegative
                                ? "var(--badge-red-text)"
                                : "var(--color-blue-cornflower)",
                            }}
                          >
                            {isPositive ? "+" : isNegative ? "-" : ""}
                            {formatAmount(mov.amount, mov.account.currency.code, mov.account.currency.symbol)}
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

        {/* Vista Mobile */}
        <div className="flowbite-mobile-card-list">
          {filteredMovements.length === 0 ? (
            <GlassCard style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-ash)" }}>
              No se encontraron movimientos registrados con los filtros seleccionados.
            </GlassCard>
          ) : (
            filteredMovements.map((mov) => {
              const typeBadge = getMovementTypeBadge(mov.type);
              const isPositive = mov.type === "INCOME" || (mov.type === "ADJUSTMENT" && mov.amount >= 0);
              const isNegative = mov.type === "EXPENSE";

              return (
                <GlassCard key={mov.id} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontWeight: 600, color: "var(--color-snow)", display: "block" }}>{mov.concept}</span>
                      <span style={{ fontSize: "11px", color: "var(--color-ash)", fontFamily: "var(--font-jetbrains-mono)" }}>
                        {new Date(mov.date).toLocaleString("es-AR", {
                          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <span className={`flowbite-badge ${typeBadge.badge}`}>{typeBadge.label}</span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: 600, color: "var(--color-snow)", fontSize: "13px" }}>{mov.account.name}</span>
                      <span className="flowbite-badge flowbite-badge-gray" style={{ fontSize: "10px" }}>{mov.account.currency.code}</span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: isPositive ? "var(--badge-green-text)" : isNegative ? "var(--badge-red-text)" : "var(--color-blue-cornflower)",
                      }}
                    >
                      {isPositive ? "+" : isNegative ? "-" : ""}
                      {formatAmount(mov.amount, mov.account.currency.code, mov.account.currency.symbol)}
                    </span>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR MOVIMIENTO                                              */}
      {/* ========================================================================= */}
      {isMovementModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsMovementModalOpen(false)}>
            <div className="flowbite-drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px", width: "100%" }}>
              <div className="flowbite-drawer-header">
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span className="section-eyebrow" style={{ fontSize: "10px", margin: 0, padding: "2px 10px" }}>
                    TRANSACCIÓN DE TESORERÍA
                  </span>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", margin: 0 }}>
                    Registrar Movimiento
                  </h3>
                </div>
                <button onClick={() => setIsMovementModalOpen(false)} className="flowbite-btn-text" style={{ fontSize: "18px", padding: "6px" }}>✕</button>
              </div>

              <form onSubmit={handleCreateMovement} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <div className="flowbite-drawer-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Cuenta */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Cuenta / Caja de Tesorería *</label>
                    <LiquidSelect
                      value={movForm.accountId}
                      onChange={(val) => setMovForm({ ...movForm, accountId: val })}
                      placeholder="Seleccione una cuenta..."
                      required
                      options={accounts.map((acc) => ({
                        value: acc.id,
                        label: `${acc.name} (${acc.currency.code})`,
                        sublabel: `Saldo: ${formatAmount(acc.balance, acc.currency.code, acc.currency.symbol)}`,
                      }))}
                    />
                  </div>

                  {/* Tipo de Movimiento */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Tipo de Movimiento *</label>
                    <LiquidSelect
                      value={movForm.type}
                      onChange={(val) => setMovForm({ ...movForm, type: val })}
                      options={[
                        { value: "INCOME", label: "Ingreso (Entrada de dinero / Crédito)" },
                        { value: "EXPENSE", label: "Egreso (Salida de dinero / Gasto / Retiro)" },
                        { value: "ADJUSTMENT", label: "Ajuste Contable (+)" },
                      ]}
                    />
                  </div>

                {/* Monto */}
                <div className="flowbite-form-group" style={{ margin: 0 }}>
                  <label className="flowbite-form-label">Monto *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={movForm.amount}
                    onChange={(e) => setMovForm({ ...movForm, amount: e.target.value })}
                    className="flowbite-input"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  />
                </div>

                {/* Concepto */}
                <div className="flowbite-form-group" style={{ margin: 0 }}>
                  <label className="flowbite-form-label">Concepto / Motivo *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej. Aporte de capital, Pago de alquiler, Comisión..."
                    value={movForm.concept}
                    onChange={(e) => setMovForm({ ...movForm, concept: e.target.value })}
                    className="flowbite-input"
                  />
                </div>

                {/* Referencia */}
                <div className="flowbite-form-group" style={{ margin: 0 }}>
                  <label className="flowbite-form-label">N° de Comprobante / Referencia (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. REC-00912, TX-992381"
                    value={movForm.reference}
                    onChange={(e) => setMovForm({ ...movForm, reference: e.target.value })}
                    className="flowbite-input"
                  />
                </div>

                {/* Fecha */}
                <div className="flowbite-form-group" style={{ margin: 0 }}>
                  <label className="flowbite-form-label">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    value={movForm.date}
                    onChange={(e) => setMovForm({ ...movForm, date: e.target.value })}
                    className="flowbite-input"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  />
                </div>
              </div>

              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--color-steel-border)", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsMovementModalOpen(false)} className="flowbite-btn">
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading} className="flowbite-btn flowbite-btn-primary">
                  {actionLoading ? "Registrando..." : "Guardar Movimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TRANSFERIR ENTRE CUENTAS                                         */}
      {/* ========================================================================= */}
      {isTransferModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsTransferModalOpen(false)}>
            <div className="flowbite-drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px", width: "100%" }}>
              <div className="flowbite-drawer-header">
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span className="section-eyebrow" style={{ fontSize: "10px", margin: 0, padding: "2px 10px" }}>
                    FONDEO INTERNO
                  </span>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", margin: 0 }}>
                    Transferencia Entre Cajas
                  </h3>
                </div>
                <button onClick={() => setIsTransferModalOpen(false)} className="flowbite-btn-text" style={{ fontSize: "18px", padding: "6px" }}>✕</button>
              </div>

              <form onSubmit={handleTransfer} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <div className="flowbite-drawer-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="flowbite-alert flowbite-alert-info" style={{ fontSize: "12px", padding: "10px 14px", margin: 0 }}>
                    Las transferencias directas de tesorería se realizan entre cuentas de la misma divisa (ej. Depósito de efectivo en cuenta bancaria).
                  </div>

                  {/* Cuenta Origen */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Cuenta Origen (Sale el dinero) *</label>
                    <LiquidSelect
                      value={transferForm.fromAccountId}
                      onChange={(val) => setTransferForm({ ...transferForm, fromAccountId: val })}
                      placeholder="Seleccione cuenta origen..."
                      required
                      options={accounts.map((acc) => ({
                        value: acc.id,
                        label: `${acc.name} (${acc.currency.code})`,
                        sublabel: `Saldo: ${formatAmount(acc.balance, acc.currency.code, acc.currency.symbol)}`,
                      }))}
                    />
                  </div>

                  {/* Cuenta Destino */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Cuenta Destino (Ingresa el dinero) *</label>
                    <LiquidSelect
                      value={transferForm.toAccountId}
                      onChange={(val) => setTransferForm({ ...transferForm, toAccountId: val })}
                      placeholder="Seleccione cuenta destino..."
                      required
                      options={accounts
                        .filter((acc) => acc.id !== transferForm.fromAccountId)
                        .map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${acc.currency.code})`,
                          sublabel: `Saldo: ${formatAmount(acc.balance, acc.currency.code, acc.currency.symbol)}`,
                        }))}
                    />
                  </div>

                {/* Monto */}
                <div className="flowbite-form-group" style={{ margin: 0 }}>
                  <label className="flowbite-form-label">Monto a Transferir *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    className="flowbite-input"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  />
                </div>

                {/* Concepto */}
                <div className="flowbite-form-group" style={{ margin: 0 }}>
                  <label className="flowbite-form-label">Concepto de Transferencia</label>
                  <input
                    type="text"
                    placeholder="Ej. Fondeo operativo, Depósito bancario..."
                    value={transferForm.concept}
                    onChange={(e) => setTransferForm({ ...transferForm, concept: e.target.value })}
                    className="flowbite-input"
                  />
                </div>

                {/* Referencia */}
                <div className="flowbite-form-group" style={{ margin: 0 }}>
                  <label className="flowbite-form-label">N° de Comprobante / Ticket (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. TFR-09923"
                    value={transferForm.reference}
                    onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })}
                    className="flowbite-input"
                  />
                </div>
              </div>

              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--color-steel-border)", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flowbite-btn">
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading} className="flowbite-btn flowbite-btn-primary">
                  {actionLoading ? "Procesando..." : "Realizar Transferencia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: NUEVA CAJA / CUENTA                                              */}
      {/* ========================================================================= */}
      {isAccountModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsAccountModalOpen(false)}>
            <div className="flowbite-drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px", width: "100%" }}>
              <div className="flowbite-drawer-header">
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span className="section-eyebrow" style={{ fontSize: "10px", margin: 0, padding: "2px 10px" }}>
                    ALTA DE CUENTA
                  </span>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", margin: 0 }}>
                    Nueva Caja o Cuenta
                  </h3>
                </div>
                <button onClick={() => setIsAccountModalOpen(false)} className="flowbite-btn-text" style={{ fontSize: "18px", padding: "6px" }}>✕</button>
              </div>

              <form onSubmit={handleCreateAccount} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <div className="flowbite-drawer-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Nombre */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Nombre de la Cuenta o Caja *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. Caja Mostrador 2, Banco BBVA USD, Wallet MetaMask"
                      value={accountForm.name}
                      onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                      className="flowbite-input"
                    />
                  </div>

                  {/* Tipo de cuenta */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Tipo de Entidad *</label>
                    <LiquidSelect
                      value={accountForm.type}
                      onChange={(val) => setAccountForm({ ...accountForm, type: val as any })}
                      options={[
                        { value: "CASH", label: "Caja / Efectivo Físico" },
                        { value: "BANK", label: "Cuenta Bancaria" },
                        { value: "WALLET", label: "Billetera Cripto / Digital" },
                      ]}
                    />
                  </div>

                  {/* Moneda */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Moneda Operativa *</label>
                    <LiquidSelect
                      value={accountForm.currencyId}
                      onChange={(val) => setAccountForm({ ...accountForm, currencyId: val })}
                      options={currencies.map((c) => ({
                        value: c.id,
                        label: `${c.code} — ${c.name} (${c.symbol})`,
                      }))}
                    />
                  </div>

                  {/* Saldo Inicial */}
                  <div className="flowbite-form-group" style={{ margin: 0 }}>
                    <label className="flowbite-form-label">Saldo Inicial de Apertura (Opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={accountForm.initialBalance}
                      onChange={(e) => setAccountForm({ ...accountForm, initialBalance: e.target.value })}
                      className="flowbite-input"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    />
                  </div>
                </div>

                <div style={{ padding: "16px 24px", borderTop: "1px solid var(--color-steel-border)", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setIsAccountModalOpen(false)} className="flowbite-btn">
                    Cancelar
                  </button>
                  <button type="submit" disabled={actionLoading} className="flowbite-btn flowbite-btn-primary">
                    {actionLoading ? "Guardando..." : "Crear Cuenta"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
