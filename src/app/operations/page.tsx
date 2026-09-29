"use client";

import { useState, useEffect } from "react";
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
  LiquidMenu,
} from "@liquefy-ui/react";

export default function OperationsPage() {
  const [operations, setOperations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  const [filterState, setFilterState] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isAdminPromptOpen, setIsAdminPromptOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPromptError, setAdminPromptError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [verifiedAdminPassword, setVerifiedAdminPassword] = useState("");
  const [activeStateChangeOp, setActiveStateChangeOp] = useState<any | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [historyModalOp, setHistoryModalOp] = useState<any | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    providerId: "",
    originCurrencyId: "",
    originAmount: "",
    destCurrencyId: "",
    destAmount: "",
    exchangeRate: "",
    operationDate: new Date().toISOString().split("T")[0],
    observations: "",
    state: "PENDING",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resOps, resContacts, resCur] = await Promise.all([
        fetch("/api/operations"),
        fetch("/api/contacts"),
        fetch("/api/currencies"),
      ]);
      const dataOps = await resOps.json();
      const dataContacts = await resContacts.json();
      const dataCur = await resCur.json();

      if (dataOps.operations) setOperations(dataOps.operations);
      if (dataContacts.contacts) setContacts(dataContacts.contacts);
      if (dataCur.currencies) setCurrencies(dataCur.currencies);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lógica de cálculo en tiempo real
  useEffect(() => {
    const origin = parseFloat(formData.originAmount);
    const rate = parseFloat(formData.exchangeRate);
    if (!isNaN(origin) && !isNaN(rate) && rate !== 0) {
      const calculatedDest = (origin * rate).toFixed(2);
      if (Math.abs(parseFloat(calculatedDest) - parseFloat(formData.destAmount || "0")) > 0.01) {
        setFormData((prev) => ({ ...prev, destAmount: calculatedDest }));
      }
    }
  }, [formData.originAmount, formData.exchangeRate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/operations/${editingId}` : "/api/operations";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          adminPassword: verifiedAdminPassword || undefined,
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setVerifiedAdminPassword("");
        fetchData();
        setFormData({
          clientId: "",
          providerId: "",
          originCurrencyId: "",
          originAmount: "",
          destCurrencyId: "",
          destAmount: "",
          exchangeRate: "",
          operationDate: new Date().toISOString().split("T")[0],
          observations: "",
          state: "PENDING",
        });
      } else {
        const errData = await res.json();
        alert(errData.error || "Error al guardar la operación");
      }
    } catch (error) {
      alert("Error de red");
    }
  };

  const handleVerifyAdminPassword = async () => {
    setAdminPromptError(null);
    try {
      const res = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifiedAdminPassword(adminPasswordInput);
        setIsAdminPromptOpen(false);
        setAdminPasswordInput("");

        if (pendingAction) {
          if (pendingAction.type === "EDIT") {
            const op = pendingAction.payload;
            setFormData({
              clientId: op.clientId,
              providerId: op.providerId,
              originCurrencyId: op.originCurrencyId,
              originAmount: op.originAmount.toString(),
              destCurrencyId: op.destCurrencyId,
              destAmount: op.destAmount.toString(),
              exchangeRate: op.exchangeRate.toString(),
              operationDate: new Date(op.operationDate).toISOString().split("T")[0],
              observations: op.observations || "",
              state: op.state,
            });
            setEditingId(op.id);
            setIsModalOpen(true);
          } else if (pendingAction.type === "STATE_CHANGE") {
            const { op, newState } = pendingAction.payload;
            try {
              const patchRes = await fetch(`/api/operations/${op.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: newState, adminPassword: adminPasswordInput }),
              });
              if (patchRes.ok) {
                fetchData();
              } else {
                const patchData = await patchRes.json();
                alert(patchData.error || "Error al cambiar el estado");
              }
            } catch (error) {
              alert("Error de red");
            }
          }
          setPendingAction(null);
        }
      } else {
        setAdminPromptError(data.error || "Contraseña de administrador incorrecta");
      }
    } catch (err) {
      setAdminPromptError("Error de conexión con el servidor");
    }
  };

  const handleEdit = (op: any) => {
    setFormData({
      clientId: op.clientId,
      providerId: op.providerId,
      originCurrencyId: op.originCurrencyId,
      originAmount: op.originAmount.toString(),
      destCurrencyId: op.destCurrencyId,
      destAmount: op.destAmount.toString(),
      exchangeRate: op.exchangeRate.toString(),
      operationDate: new Date(op.operationDate).toISOString().split("T")[0],
      observations: op.observations || "",
      state: op.state,
    });
    setEditingId(op.id);
    setIsModalOpen(true);
  };

  const handleStateChange = async (op: any, newState: string) => {
    try {
      const res = await fetch(`/api/operations/${op.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });
      if (res.ok) {
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Error al cambiar el estado");
      }
    } catch (error) {
      alert("Error de red");
    }
  };

  const openHistoryModal = async (op: any) => {
    setHistoryModalOp(op);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/operations/${op.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
      } else {
        alert("Error al cargar el historial");
      }
    } catch (error) {
      alert("Error de red");
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = operations.filter((op) => {
    if (filterState && op.state !== filterState) return false;

    if (startDate) {
      const opDate = new Date(op.operationDate).toISOString().split("T")[0];
      if (opDate < startDate) return false;
    }
    if (endDate) {
      const opDate = new Date(op.operationDate).toISOString().split("T")[0];
      if (opDate > endDate) return false;
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchClient = op.client?.name?.toLowerCase().includes(term);
      const matchProvider = op.provider?.name?.toLowerCase().includes(term);
      const matchNumber = op.operationNumber?.toLowerCase().includes(term);
      if (!matchClient && !matchProvider && !matchNumber) return false;
    }
    return true;
  });

  const clients = contacts.filter((c) => c.isClient && c.isActive);
  const providers = contacts.filter((c) => c.isProvider && c.isActive);

  return (
    <>
      <div className="animate-fade-in" style={{ padding: "1rem 0" }}>
        {/* Page Title & Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <span className="section-eyebrow">REGISTRO DE TRANSACCIONES</span>
          <h1 className="flowbite-title">Operaciones de Cambio</h1>
          <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
            Registro y control de transacciones de divisas de clientes y proveedores.
          </p>
        </div>

        {/* Flowbite Style Table Header */}
        <div className="flowbite-table-header flowbite-table-header-stacked" style={{ position: "relative", zIndex: 30 }}>
          {/* Top Controls Bar */}
          <div className="flowbite-table-header-top" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "16px" }}>
            {/* Left side: Search & Filter Toggle */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px", width: "100%", maxWidth: "100%" }}>
              <div className="flowbite-search-container" style={{ margin: 0, flex: 1, position: "relative" }}>
                <svg
                  aria-hidden="true"
                  className="flowbite-search-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flowbite-search-input"
                  placeholder="Buscar por cliente, proveedor o Nº Op..."
                  required
                />
              </div>

              {/* Botón Filtros Avanzados */}
              <button
                type="button"
                onClick={() => {
                  setIsFiltersOpen(!isFiltersOpen);
                }}
                className="flowbite-btn"
                style={{
                  padding: "9px 14px",
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  whiteSpace: "nowrap",
                  background: (isFiltersOpen || filterState || startDate || endDate)
                    ? "rgba(103, 152, 255, 0.2)"
                    : "rgba(255, 255, 255, 0.08)",
                  borderColor: (isFiltersOpen || filterState || startDate || endDate)
                    ? "rgba(103, 152, 255, 0.55)"
                    : "rgba(255, 255, 255, 0.22)",
                  color: (isFiltersOpen || filterState || startDate || endDate)
                    ? "#ffffff"
                    : "rgba(255, 255, 255, 0.8)",
                  boxShadow: (filterState || startDate || endDate)
                    ? "0 0 14px rgba(103, 152, 255, 0.3)"
                    : undefined
                }}
                title="Filtros avanzados de estado y fecha"
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
                {(filterState || startDate || endDate) && (
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
                    {[filterState ? 1 : 0, startDate || endDate ? 1 : 0].reduce((a, b) => a + b, 0)}
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

            {/* Right side: Action buttons */}
            <div className="flowbite-actions-bar">
              {/* Add New Operation Button */}
              <button
                type="button"
                className="flowbite-btn flowbite-btn-primary"
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    clientId: "",
                    providerId: "",
                    originCurrencyId: "",
                    originAmount: "",
                    destCurrencyId: "",
                    destAmount: "",
                    exchangeRate: "",
                    operationDate: new Date().toISOString().split("T")[0],
                    observations: "",
                    state: "PENDING",
                  });
                  setIsModalOpen(true);
                }}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ width: "16px", height: "16px" }}
                >
                  <path
                    clipRule="evenodd"
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  />
                </svg>
                Nueva Operación
              </button>

              {/* Action Dropdown Button */}
              <div style={{ position: "relative" }}>
                <LiquidMenu
                  align="end"
                  items={[
                    { label: "Exportar a CSV", onSelect: () => alert("Exportando registros en formato CSV...") },
                    { label: "Exportar a JSON", onSelect: () => alert("Exportando registros en formato JSON...") }
                  ]}
                  trigger={
                    <button
                      type="button"
                      className="flowbite-btn"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        style={{ width: "16px", height: "16px" }}
                      >
                        <path
                          clipRule="evenodd"
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        />
                      </svg>
                      Acciones
                    </button>
                  }
                />
              </div>
            </div>
          </div>

          {/* Panel Desplegable de Filtros (Expansión Limpia en el Flujo - Sin Superposición) */}
          {isFiltersOpen && (
            <div className="flowbite-filter-panel">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                  gap: "20px",
                  alignItems: "end"
                }}
              >
                {/* Sección: Estado */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255, 255, 255, 0.75)", letterSpacing: "0.5px" }}>
                    FILTRAR POR ESTADO
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setFilterState("")}
                      className={`flowbite-badge ${filterState === "" ? "flowbite-badge-blue" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterState("PENDING")}
                      className={`flowbite-badge ${filterState === "PENDING" ? "flowbite-badge-yellow" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Pendientes
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterState("COMPLETED")}
                      className={`flowbite-badge ${filterState === "COMPLETED" ? "flowbite-badge-green" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Completadas
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterState("CANCELED")}
                      className={`flowbite-badge ${filterState === "CANCELED" ? "flowbite-badge-red" : "flowbite-badge-gray"}`}
                      style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: "12px", transition: "all 0.15s" }}
                    >
                      Canceladas
                    </button>
                  </div>
                </div>

                {/* Sección: Rango de Fechas */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 340px", maxWidth: "480px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
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

                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
                  {(filterState || startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterState("");
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
              {(filterState || startDate || endDate) && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", fontSize: "12px", color: "rgba(255, 255, 255, 0.7)", paddingTop: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600 }}>Filtros activos:</span>
                  {filterState && (
                    <span className="flowbite-badge flowbite-badge-blue" style={{ fontSize: "11px", padding: "2px 8px" }}>
                      Estado: {filterState === "PENDING" ? "Pendiente" : filterState === "COMPLETED" ? "Completada" : "Cancelada"}
                      <button onClick={() => setFilterState("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", marginLeft: "4px", padding: 0 }}>×</button>
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

        {/* Desktop Table (Hidden on Mobile) */}
        <div className="flowbite-desktop-table-container">
          <LiquidTableContainer style={{ margin: 0 }}>
            <LiquidTable hover size="md">
              <LiquidTableHead>
                <LiquidTableRow>
                  <LiquidTableHeaderCell style={{ width: "14%" }}>Nº Operación</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "10%" }}>Fecha</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "20%" }}>Cliente</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "18%" }}>Monto Origen</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "18%" }}>Monto Destino</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "12%" }}>Estado</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "8%" }} align="right">Acciones</LiquidTableHeaderCell>
                </LiquidTableRow>
              </LiquidTableHead>
              <LiquidTableBody>
                {loading ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={7} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      Cargando operaciones...
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : filtered.length === 0 ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={7} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      No se encontraron operaciones en esta vista.
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : (
                  filtered.map((op) => (
                    <LiquidTableRow key={op.id}>
                      <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>{op.operationNumber}</LiquidTableCell>
                      <LiquidTableCell>{new Date(op.operationDate).toLocaleDateString()}</LiquidTableCell>
                      <LiquidTableCell>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                          {op.client?.name}
                        </span>
                      </LiquidTableCell>
                      <LiquidTableCell style={{ fontFamily: "monospace", fontWeight: 600 }}>
                        {Number(op.originAmount).toLocaleString()} {op.originCurrency?.code}
                      </LiquidTableCell>
                      <LiquidTableCell style={{ fontFamily: "monospace", fontWeight: 600 }}>
                        {Number(op.destAmount).toLocaleString()} {op.destCurrency?.code}
                      </LiquidTableCell>
                      <LiquidTableCell>
                        <div style={{ display: "inline-block" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveStateChangeOp(op);
                            }}
                            className={`flowbite-badge ${
                              op.state === "PENDING"
                                ? "flowbite-badge-yellow"
                                : op.state === "COMPLETED"
                                ? "flowbite-badge-green"
                                : "flowbite-badge-red"
                            }`}
                            style={{
                              border: "none",
                              cursor: "pointer",
                              outline: "none",
                              padding: "6px 12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              userSelect: "none"
                            }}
                          >
                            {op.state === "PENDING" && "Pendiente"}
                            {op.state === "COMPLETED" && "Completada"}
                            {op.state === "CANCELED" && "Cancelada"}
                            <span style={{ fontSize: "9px", color: "inherit", opacity: 0.8 }}>▼</span>
                          </button>
                        </div>
                      </LiquidTableCell>
                      <LiquidTableCell align="right">
                        <LiquidMenu
                          align="end"
                          items={[
                            { label: "✏️ Editar", onSelect: () => handleEdit(op) },
                            { label: "📜 Tracking de Historial", onSelect: () => openHistoryModal(op) }
                          ]}
                          trigger={
                            <button
                              className="flowbite-btn flowbite-btn-text"
                              style={{ padding: "4px 8px", fontSize: "12px", color: "var(--color-ash)" }}
                            >
                              Acciones ▾
                            </button>
                          }
                        />
                      </LiquidTableCell>
                    </LiquidTableRow>
                  ))
                )}
              </LiquidTableBody>
            </LiquidTable>
          </LiquidTableContainer>
        </div>

        {/* Mobile Cards List (Only shown on mobile) */}
        <div className="flowbite-mobile-card-list">
          {loading ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              Cargando operaciones...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              No se encontraron operaciones en esta vista.
            </div>
          ) : (
            filtered.map((op) => (
              <GlassCard
                key={op.id}
                onClick={() => handleEdit(op)}
                style={{
                  margin: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  borderLeft: `2px solid ${
                    op.state === "PENDING"
                      ? "var(--badge-yellow-text)"
                      : op.state === "COMPLETED"
                      ? "var(--badge-green-text)"
                      : "var(--badge-red-text)"
                  }`,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {op.operationNumber}
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {new Date(op.operationDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveStateChangeOp(op);
                      }}
                      className={`flowbite-badge ${
                        op.state === "PENDING"
                          ? "flowbite-badge-yellow"
                          : op.state === "COMPLETED"
                          ? "flowbite-badge-green"
                          : "flowbite-badge-red"
                      }`}
                      style={{
                        border: "none",
                        cursor: "pointer",
                        outline: "none",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        userSelect: "none"
                      }}
                    >
                      {op.state === "PENDING" && "Pendiente"}
                      {op.state === "COMPLETED" && "Completada"}
                      {op.state === "CANCELED" && "Cancelada"}
                      <span style={{ fontSize: "9px", color: "inherit", opacity: 0.8 }}>▼</span>
                    </button>
                  </div>
                </div>

                {/* Clients & Provider */}
                <div style={{ fontSize: "13px" }}>
                  <div>
                    <strong style={{ color: "var(--text-secondary)" }}>Cliente: </strong>
                    <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{op.client?.name}</span>
                  </div>
                  {op.provider?.name && (
                    <div style={{ marginTop: "4px" }}>
                      <strong style={{ color: "var(--text-secondary)" }}>Proveedor: </strong>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{op.provider?.name}</span>
                    </div>
                  )}
                </div>

                {/* Amounts */}
                <div style={{ display: "flex", gap: "16px", backgroundColor: "var(--hover-bg)", padding: "10px", borderRadius: "var(--radius-md)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700 }}>Origen</div>
                    <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {Number(op.originAmount).toLocaleString()} {op.originCurrency?.code}
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid var(--border-color)", paddingLeft: "16px", flex: 1 }}>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700 }}>Destino</div>
                    <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {Number(op.destAmount).toLocaleString()} {op.destCurrency?.code}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "4px",
                    borderTop: "1px solid var(--border-color)",
                    paddingTop: "8px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleEdit(op)}
                    className="flowbite-btn flowbite-btn-text"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                  >
                    ️ Editar Ficha
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>

      {/* Flowbite Drawer (Slide-out Form) */}
      {isModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="flowbite-drawer" style={{ width: "100%", maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
              {/* Header toolbar */}
              <div className="flowbite-drawer-header">
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                  {editingId ? "Editar Ficha de Operación" : "Nueva Ficha de Operación"}
                </span>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    setVerifiedAdminPassword("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-lg)",
                    transition: "background-color 0.15s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  ✕
                </button>
              </div>

              {/* Content Body */}
              <div className="flowbite-drawer-body">
                <form onSubmit={handleSave}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Client Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Cliente *</label>
                      <LiquidSelect
                        value={formData.clientId}
                        onChange={(val) => setFormData({ ...formData, clientId: val })}
                        placeholder="Seleccione Cliente..."
                        required
                        options={clients.map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                      />
                    </div>

                    {/* Provider Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Proveedor *</label>
                      <LiquidSelect
                        value={formData.providerId}
                        onChange={(val) => setFormData({ ...formData, providerId: val })}
                        placeholder="Seleccione Proveedor..."
                        required
                        options={providers.map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                      />
                    </div>

                    {/* Origin Currency Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Moneda Origen *</label>
                      <LiquidSelect
                        value={formData.originCurrencyId}
                        onChange={(val) => setFormData({ ...formData, originCurrencyId: val })}
                        placeholder="Seleccione Moneda..."
                        required
                        options={currencies.map((c) => ({
                          value: c.id,
                          label: `${c.code} - ${c.name}`,
                        }))}
                      />
                    </div>

                    {/* Origin Amount Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Monto Origen *</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.originAmount}
                        onChange={(e) => setFormData({ ...formData, originAmount: e.target.value })}
                        className="flowbite-input"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Destination Currency Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Moneda Destino *</label>
                      <LiquidSelect
                        value={formData.destCurrencyId}
                        onChange={(val) => setFormData({ ...formData, destCurrencyId: val })}
                        placeholder="Seleccione Moneda..."
                        required
                        options={currencies.map((c) => ({
                          value: c.id,
                          label: `${c.code} - ${c.name}`,
                        }))}
                      />
                    </div>

                    {/* Destination Amount Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">🪙 Monto Destino *</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.destAmount}
                        onChange={(e) => setFormData({ ...formData, destAmount: e.target.value })}
                        className="flowbite-input"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Exchange Rate Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Tipo Cambio *</label>
                      <input
                        required
                        type="number"
                        step="0.0001"
                        value={formData.exchangeRate}
                        onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                        className="flowbite-input"
                        placeholder="1.0000"
                      />
                      <small style={{ display: "block", color: "var(--text-secondary)", marginTop: "4px", fontSize: "11px" }}>
                        Monto Destino auto-calculado: (Origen × T.C.)
                      </small>
                    </div>

                    {/* Date Property */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Fecha *</label>
                      <input
                        required
                        type="date"
                        value={formData.operationDate}
                        onChange={(e) => setFormData({ ...formData, operationDate: e.target.value })}
                        className="flowbite-input"
                      />
                    </div>

                    {/* Status Property (only editing) */}
                    {editingId && (
                      <div className="flowbite-form-group">
                        <label className="flowbite-form-label">⊙ Estado *</label>
                        <LiquidSelect
                          value={formData.state}
                          onChange={(val) => setFormData({ ...formData, state: val })}
                          options={[
                            { value: "PENDING", label: "Pendiente" },
                            { value: "COMPLETED", label: "Completada" },
                            { value: "CANCELED", label: "Cancelada" },
                          ]}
                        />
                      </div>
                    )}

                  {/* Observations Property */}
                  <div className="flowbite-form-group">
                    <label className="flowbite-form-label">Observaciones</label>
                    <textarea
                      rows={3}
                      value={formData.observations}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                      className="flowbite-input"
                      placeholder="Agregar notas..."
                      style={{ fontFamily: "inherit", resize: "vertical" }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "2.5rem",
                    paddingTop: "1.25rem",
                    borderTop: "1px solid var(--border-color)",
                  }}
                >
                  <button
                    type="button"
                    className="flowbite-btn flowbite-btn-text"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingId(null);
                      setVerifiedAdminPassword("");
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="flowbite-btn flowbite-btn-primary">
                    {editingId ? "Actualizar Ficha" : "Crear Ficha"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Portal>
      )}

      {activeStateChangeOp && (
        <Portal>
          <div
            className="flowbite-drawer-overlay animate-fade-in"
            style={{ justifyContent: "center", alignItems: "center", zIndex: 105 }}
            onClick={() => setActiveStateChangeOp(null)}
          >
            <GlassCard
              className="flowbite-dropdown-animate"
              style={{
                width: "90%",
                maxWidth: "360px",
                margin: "0 auto",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cambiar Estado
                </span>
                <button
                  onClick={() => setActiveStateChangeOp(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Operación seleccionada:</p>
                <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>{activeStateChangeOp.operationNumber}</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Cliente: {activeStateChangeOp.client?.name}</p>
              </div>

              {/* State Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  onClick={() => {
                    handleStateChange(activeStateChangeOp, "PENDING");
                    setActiveStateChangeOp(null);
                  }}
                  className="flowbite-btn"
                  style={{ width: "100%", justifyContent: "center", padding: "10px" }}
                >
                  <span className="flowbite-badge flowbite-badge-yellow" style={{ width: "100%", justifyContent: "center", padding: "6px 12px" }}>Pendiente</span>
                </button>
                
                <button
                  onClick={() => {
                    handleStateChange(activeStateChangeOp, "COMPLETED");
                    setActiveStateChangeOp(null);
                  }}
                  className="flowbite-btn"
                  style={{ width: "100%", justifyContent: "center", padding: "10px" }}
                >
                  <span className="flowbite-badge flowbite-badge-green" style={{ width: "100%", justifyContent: "center", padding: "6px 12px" }}>Completada</span>
                </button>

                <button
                  onClick={() => {
                    handleStateChange(activeStateChangeOp, "CANCELED");
                    setActiveStateChangeOp(null);
                  }}
                  className="flowbite-btn"
                  style={{ width: "100%", justifyContent: "center", padding: "10px" }}
                >
                  <span className="flowbite-badge flowbite-badge-red" style={{ width: "100%", justifyContent: "center", padding: "6px 12px" }}>Cancelada</span>
                </button>
              </div>
            </GlassCard>
          </div>
        </Portal>
      )}

      {historyModalOp && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setHistoryModalOp(null)}>
            <div className="flowbite-drawer" style={{ width: "100%", maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
              <div className="flowbite-drawer-header">
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                  📜 Tracking de Operación {historyModalOp.operationNumber}
                </span>
                <button onClick={() => setHistoryModalOp(null)} className="flowbite-drawer-close">✕</button>
              </div>
              <div className="flowbite-drawer-body">
                {historyLoading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Cargando historial...</div>
                ) : historyLogs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No hay cambios registrados.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {historyLogs.map((log) => {
                      const oldVals = log.oldValues ? JSON.parse(log.oldValues) : {};
                      const newVals = log.newValues ? JSON.parse(log.newValues) : {};
                      const fieldsChanged = Object.keys(newVals);
                      return (
                        <div key={log.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                            <span><strong>{log.user?.username || "Usuario"}</strong> ({log.action})</span>
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: "13px" }}>
                            {fieldsChanged.map(field => {
                              const label = field === "state" ? "Estado" : field === "originAmount" ? "Monto Origen" : field === "destAmount" ? "Monto Destino" : field;
                              return (
                                <div key={field} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                  <span style={{ color: "var(--color-ash)" }}>{label}:</span>
                                  <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{oldVals[field] || "-"}</span>
                                  <span>→</span>
                                  <span style={{ color: "var(--primary-color)" }}>{newVals[field] || "-"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {historyModalOp && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setHistoryModalOp(null)}>
            <div className="flowbite-drawer" style={{ width: "100%", maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
              <div className="flowbite-drawer-header">
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                  📜 Tracking de Operación {historyModalOp.operationNumber}
                </span>
                <button onClick={() => setHistoryModalOp(null)} className="flowbite-drawer-close">✕</button>
              </div>
              <div className="flowbite-drawer-body">
                {historyLoading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Cargando historial...</div>
                ) : historyLogs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No hay cambios registrados.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {historyLogs.map((log) => {
                      const oldVals = log.oldValues ? JSON.parse(log.oldValues) : {};
                      const newVals = log.newValues ? JSON.parse(log.newValues) : {};
                      const fieldsChanged = Object.keys(newVals);
                      return (
                        <div key={log.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                            <span><strong>{log.user?.username || "Usuario"}</strong> ({log.action})</span>
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: "13px" }}>
                            {fieldsChanged.map(field => {
                              const label = field === "state" ? "Estado" : field === "originAmount" ? "Monto Origen" : field === "destAmount" ? "Monto Destino" : field;
                              return (
                                <div key={field} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                  <span style={{ color: "var(--color-ash)" }}>{label}:</span>
                                  <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{oldVals[field] || "-"}</span>
                                  <span>→</span>
                                  <span style={{ color: "var(--primary-color)" }}>{newVals[field] || "-"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
