"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OperationsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  
  const [filterState, setFilterState] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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

  useEffect(() => {
    setPage(1);
  }, [filterState, searchTerm, startDate, endDate]);

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isDistributedModalOpen, setIsDistributedModalOpen] = useState(false);
  const [isSubmittingDistributed, setIsSubmittingDistributed] = useState(false);
  const [expandedOpIds, setExpandedOpIds] = useState<string[]>([]);
  const [calcMode, setCalcMode] = useState<"multiply" | "divide">("multiply");

  const [distributedData, setDistributedData] = useState({
    providerId: "",
    currencyId: "",
    exchangeRate: "",
    operationDate: new Date().toISOString().split("T")[0],
    observations: "",
    items: [
      { clientId: "", exchangeRate: "", amount: "", observations: "", isPaid: true }
    ],
  });

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

  const { data: contactsData } = useSWR("/api/contacts", fetcher);
  const { data: currenciesData } = useSWR("/api/currencies", fetcher);

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search: searchTerm,
    state: filterState,
    startDate,
    endDate
  });

  const { data: operationsData, error: opsError, isLoading: loading, mutate: fetchData } = useSWR(
    `/api/operations?${queryParams.toString()}`,
    fetcher,
    { keepPreviousData: true }
  );

  const operations = operationsData?.operations || [];
  const contacts = contactsData?.contacts || [];
  const currencies = currenciesData?.currencies || [];


  // Lógica de cálculo en tiempo real
  useEffect(() => {
    const origin = parseFloat(formData.originAmount);
    const rate = parseFloat(formData.exchangeRate);
    if (!isNaN(origin) && !isNaN(rate) && rate !== 0) {
      const calculatedDest = calcMode === "multiply" 
        ? (origin * rate).toFixed(2)
        : (origin / rate).toFixed(2);
      if (Math.abs(parseFloat(calculatedDest) - parseFloat(formData.destAmount || "0")) > 0.01) {
        setFormData((prev) => ({ ...prev, destAmount: calculatedDest }));
      }
    }
  }, [formData.originAmount, formData.exchangeRate, calcMode]);

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
            handleEdit(op);
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
    if (op.type === "DISTRIBUTED_SALE" || (op.childOperations && op.childOperations.length > 0)) {
      setDistributedData({
        providerId: op.providerId || "",
        currencyId: op.originCurrencyId || "",
        exchangeRate: op.exchangeRate ? op.exchangeRate.toString() : "",
        operationDate: op.operationDate ? new Date(op.operationDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        observations: op.observations || "",
        items: op.childOperations && op.childOperations.length > 0
          ? op.childOperations.map((child: any) => ({
              clientId: child.clientId || "",
              exchangeRate: child.exchangeRate ? child.exchangeRate.toString() : "",
              amount: child.originAmount ? child.originAmount.toString() : "",
              observations: child.observations || "",
              isPaid: child.isPaid ?? true,
            }))
          : [{ clientId: "", exchangeRate: "", amount: "", observations: "", isPaid: true }],
      });
      setEditingId(op.id);
      setIsDistributedModalOpen(true);
      return;
    }

    setFormData({
      clientId: op.clientId || "",
      providerId: op.providerId || "",
      originCurrencyId: op.originCurrencyId || "",
      originAmount: op.originAmount ? op.originAmount.toString() : "",
      destCurrencyId: op.destCurrencyId || "",
      destAmount: op.destAmount ? op.destAmount.toString() : "",
      exchangeRate: op.exchangeRate ? op.exchangeRate.toString() : "",
      operationDate: op.operationDate ? new Date(op.operationDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      observations: op.observations || "",
      state: op.state || "PENDING",
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

  const toggleExpandOp = (opId: string) => {
    setExpandedOpIds((prev) =>
      prev.includes(opId) ? prev.filter((id) => id !== opId) : [...prev, opId]
    );
  };

  const handleAddDistributedItem = () => {
    setDistributedData((prev) => ({
      ...prev,
      items: [...prev.items, { clientId: "", exchangeRate: "", amount: "", observations: "", isPaid: true }],
    }));
  };

  const handleRemoveDistributedItem = (index: number) => {
    setDistributedData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleDistributedItemChange = (index: number, field: string, value: any) => {
    setDistributedData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  
  const handleDeleteOperation = async (op: any) => {
    const confirmDelete = confirm(`¿Está seguro que desea eliminar la operación ${op.operationNumber}? Esto revertirá las transacciones y ajustará los saldos de cuentas corrientes asociadas.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/operations/${op.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert(`Operación ${op.operationNumber} eliminada y saldos ajustados correctamente.`);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar la operación");
      }
    } catch (error) {
      alert("Error de conexión al servidor");
    }
  };

  const handleSaveDistributedSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributedData.providerId || !distributedData.currencyId || !distributedData.exchangeRate) {
      alert("Complete los datos requeridos de la cabecera (Proveedor, Moneda, Cotización)");
      return;
    }
    if (distributedData.items.length === 0) {
      alert("Debe agregar al menos una línea de cliente");
      return;
    }
    for (let i = 0; i < distributedData.items.length; i++) {
      const item = distributedData.items[i];
      if (!item.clientId) {
        alert(`Seleccione el cliente en la línea #${i + 1}`);
        return;
      }
      const val = parseFloat(item.amount);
      if (isNaN(val) || val <= 0) {
        alert(`El monto en la línea #${i + 1} debe ser un número positivo`);
        return;
      }
    }

    setIsSubmittingDistributed(true);
    try {
      const url = editingId ? `/api/operations/distributed-sale/${editingId}` : "/api/operations/distributed-sale";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(distributedData),
      });

      if (res.ok) {
        setIsDistributedModalOpen(false);
        setEditingId(null);
        setDistributedData({
          providerId: "",
          currencyId: "",
          exchangeRate: "",
          operationDate: new Date().toISOString().split("T")[0],
          observations: "",
          items: [{ clientId: "", exchangeRate: "", amount: "", observations: "", isPaid: true }],
        });
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Error al crear/actualizar la operación distribuida");
      }
    } catch (error) {
      alert("Error de conexión al servidor");
    } finally {
      setIsSubmittingDistributed(false);
    }
  };

  const filtered = operations.filter((op) => {
    if (op.parentOperationId) return false; // Las hijas se muestran anidadas bajo su padre
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
            REGISTRO DE TRANSACCIONES
          </span>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--ots-text-primary)", letterSpacing: "-0.02em", margin: "2px 0 4px 0" }}>
            Operaciones de Cambio
          </h1>
          <p style={{ color: "var(--ots-text-secondary)", fontSize: "14px" }}>
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
                onClick={() => setIsTypeSelectorOpen(true)}
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
                  <LiquidTableHeaderCell style={{ width: "12%" }}>Nº Operación</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "10%" }}>Fecha</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "14%" }}>Tipo</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "16%" }}>Monto Origen</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "16%" }}>Monto Destino</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "10%" }}>Pagado</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "10%" }}>Estado</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "12%" }} align="right">Acciones</LiquidTableHeaderCell>
                </LiquidTableRow>
              </LiquidTableHead>
              <LiquidTableBody>
                {loading ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={8} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      Cargando operaciones...
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : filtered.length === 0 ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={8} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      No se encontraron operaciones en esta vista.
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : (
                  filtered.map((op) => {
                    const isDistributed = op.type === "DISTRIBUTED_SALE" || (op.childOperations && op.childOperations.length > 0);
                    const paidText = isDistributed
                      ? (op.isPaid ? "Sí" : (op.childOperations?.some((c: any) => c.isPaid) ? "Parcial" : "No"))
                      : (op.isPaid ? "Sí" : "No");
                    const paidBadgeClass = paidText === "Sí" ? "flowbite-badge-green" : paidText === "Parcial" ? "flowbite-badge-blue" : "flowbite-badge-yellow";

                    return (
                      <LiquidTableRow key={op.id}>
                        <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>{op.operationNumber}</LiquidTableCell>
                        <LiquidTableCell>{new Date(op.operationDate).toLocaleDateString()}</LiquidTableCell>
                        <LiquidTableCell>
                          <span
                            className="flowbite-badge flowbite-badge-purple"
                            style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}
                          >
                            {isDistributed ? "Venta Distribuida" : "Estándar 1 a 1"}
                          </span>
                        </LiquidTableCell>
                        <LiquidTableCell style={{ fontFamily: "monospace", fontWeight: 600 }}>
                          {Number(op.originAmount).toLocaleString()} {op.originCurrency?.code}
                        </LiquidTableCell>
                        <LiquidTableCell style={{ fontFamily: "monospace", fontWeight: 600 }}>
                          {Number(op.destAmount).toLocaleString()} {op.destCurrency?.code}
                        </LiquidTableCell>
                        <LiquidTableCell>
                          <span
                            className={`flowbite-badge ${paidBadgeClass}`}
                            style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}
                          >
                            {paidText}
                          </span>
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
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleEdit(op)}
                              className="flowbite-btn flowbite-btn-text"
                              style={{ padding: "4px 8px", fontSize: "12px" }}
                              title="Editar Ficha"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => openHistoryModal(op)}
                              className="flowbite-btn flowbite-btn-text"
                              style={{ padding: "4px 8px", fontSize: "12px" }}
                              title="Ver Historial"
                            >
                              📜 Historial
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOperation(op)}
                              className="flowbite-btn flowbite-btn-text"
                              style={{ padding: "4px 8px", fontSize: "12px", color: "var(--ots-danger)" }}
                              title="Eliminar Registro y ajustar saldos"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </LiquidTableCell>
                      </LiquidTableRow>
                    );
                  })
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
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleEdit(op)}
                      className="flowbite-btn flowbite-btn-text"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openHistoryModal(op)}
                      className="flowbite-btn flowbite-btn-text"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                    >
                      📜 Historial
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOperation(op)}
                      className="flowbite-btn flowbite-btn-text"
                      style={{ padding: "6px 12px", fontSize: "12px", color: "var(--ots-danger)" }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {operationsData?.pagination && operationsData.pagination.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flowbite-btn"
              style={{ padding: "8px 16px", fontSize: "13px", opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              Anterior
            </button>
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Página <strong style={{ color: "var(--text-primary)" }}>{page}</strong> de {operationsData.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(operationsData.pagination.totalPages, p + 1))}
              disabled={page === operationsData.pagination.totalPages}
              className="flowbite-btn"
              style={{ padding: "8px 16px", fontSize: "13px", opacity: page === operationsData.pagination.totalPages ? 0.5 : 1, cursor: page === operationsData.pagination.totalPages ? "not-allowed" : "pointer" }}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Flowbite Drawer / Centered Modal for Standard 1-to-1 Operation */}
      {isModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsModalOpen(false)}>
            <div
              className="flowbite-drawer"
              style={{
                width: "100%",
                maxWidth: "780px",
                backgroundColor: "var(--ots-surface-1)",
                borderRadius: "var(--ots-radius-lg)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                margin: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header toolbar */}
              <div className="flowbite-drawer-header" style={{ padding: "1.25rem 1.75rem", backgroundColor: "var(--ots-surface-2)" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ots-primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    OPERACIÓN ESTÁNDAR
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ots-text-primary)", margin: "2px 0 0 0" }}>
                    {editingId ? "Editar Ficha de Operación" : "Nueva Operación (1 a 1)"}
                  </h3>
                </div>
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
                    color: "var(--ots-text-muted)",
                    padding: "6px 10px",
                    borderRadius: "var(--ots-radius-md)",
                    transition: "background-color 0.15s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--ots-surface-3)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  ✕
                </button>
              </div>

              {/* Content Body */}
              <div className="flowbite-drawer-body" style={{ padding: "1.75rem", maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
                <form onSubmit={handleSave}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Fila 1: Contactos (Cliente & Proveedor) */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
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

                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <label className="flowbite-form-label">Proveedor *</label>
                        <LiquidSelect
                          value={formData.providerId}
                          onChange={(val) => setFormData({ ...formData, providerId: val })}
                          placeholder="Seleccione Proveedor..."
                          required
                          options={providers.map((p) => ({
                            value: p.id,
                            label: p.name,
                          }))}
                        />
                      </div>
                    </div>

                    {/* Fila 2: Moneda y Monto Origen */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
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

                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <label className="flowbite-form-label">Monto Origen *</label>
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={formData.originAmount}
                          onChange={(e) => setFormData({ ...formData, originAmount: e.target.value })}
                          className="flowbite-input"
                          placeholder="0.00"
                          style={{ fontFamily: "var(--ots-font-mono)", fontSize: "15px" }}
                        />
                      </div>
                    </div>

                    {/* Fila 3: Moneda Destino y Cotización */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
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

                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <label className="flowbite-form-label" style={{ marginBottom: 0 }}>Tipo de Cambio (Cotización) *</label>
                          <button 
                            type="button"
                            onClick={() => setCalcMode(prev => prev === "multiply" ? "divide" : "multiply")}
                            style={{ 
                              fontSize: "11px", 
                              fontWeight: 600, 
                              background: "var(--ots-surface-2)", 
                              padding: "2px 8px", 
                              borderRadius: "4px",
                              border: "1px solid var(--ots-border)",
                              cursor: "pointer",
                              color: "var(--ots-text-primary)"
                            }}
                            title="Cambiar operador matemático para calcular Monto Destino"
                          >
                            {calcMode === "multiply" ? "Operador: (x) Multiplicar" : "Operador: (÷) Dividir"}
                          </button>
                        </div>
                        <input
                          required
                          type="number"
                          step="0.0001"
                          value={formData.exchangeRate}
                          onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                          className="flowbite-input"
                          placeholder="1.0000"
                          style={{ fontFamily: "var(--ots-font-mono)", fontSize: "15px" }}
                        />
                      </div>
                    </div>

                    {/* Fila 4: Monto Destino (Auto-calculado) y Fecha */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <label className="flowbite-form-label">Monto Destino (Calculado) *</label>
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={formData.destAmount}
                          onChange={(e) => setFormData({ ...formData, destAmount: e.target.value })}
                          className="flowbite-input"
                          placeholder="0.00"
                          style={{ fontFamily: "var(--ots-font-mono)", fontSize: "15px", backgroundColor: "var(--ots-surface-2)" }}
                        />
                      </div>

                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <label className="flowbite-form-label">Fecha Operativa *</label>
                        <input
                          required
                          type="date"
                          value={formData.operationDate}
                          onChange={(e) => setFormData({ ...formData, operationDate: e.target.value })}
                          className="flowbite-input"
                        />
                      </div>
                    </div>

                    {/* Fila Estado (solo si está editando) */}
                    {editingId && (
                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <label className="flowbite-form-label">Estado de la Operación *</label>
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

                    {/* Observaciones */}
                    <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                      <label className="flowbite-form-label">Observaciones</label>
                      <textarea
                        rows={2}
                        value={formData.observations}
                        onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                        className="flowbite-input"
                        placeholder="Notas contables u operativas..."
                        style={{ fontFamily: "inherit", resize: "vertical", width: "100%", minHeight: "70px" }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "12px",
                      marginTop: "2rem",
                      paddingTop: "1.25rem",
                      borderTop: "1px solid var(--ots-border)",
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
                      style={{ padding: "9px 18px" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flowbite-btn flowbite-btn-primary"
                      style={{ padding: "9px 24px" }}
                    >
                      {editingId ? "Actualizar Operación" : "Crear Operación"}
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

      {/* --------------------------------------------------------- */}
      {/* MODAL 1: SELECTOR DE TIPO DE OPERACIÓN                     */}
      {/* --------------------------------------------------------- */}
      {isTypeSelectorOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsTypeSelectorOpen(false)}>
            <div
              style={{
                backgroundColor: "var(--ots-surface-1)",
                border: "1px solid var(--ots-border)",
                borderRadius: "var(--ots-radius-lg)",
                width: "90%",
                maxWidth: "600px",
                padding: "24px",
                margin: "auto",
                boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ots-text-muted)", letterSpacing: "0.08em" }}>
                    NUEVA OPERACIÓN
                  </span>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ots-text-primary)", marginTop: "2px" }}>
                    Seleccione el Tipo de Operación
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTypeSelectorOpen(false)}
                  style={{ background: "none", border: "none", color: "var(--ots-text-muted)", fontSize: "18px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Opción 1: Venta distribuida por clientes */}
                <div
                  onClick={() => {
                    setIsTypeSelectorOpen(false);
                    setIsDistributedModalOpen(true);
                  }}
                  style={{
                    backgroundColor: "var(--ots-surface-2)",
                    border: "1px solid var(--ots-primary)",
                    borderRadius: "var(--ots-radius-md)",
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.12)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "var(--ots-surface-2)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--ots-text-primary)" }}>
                      1. Venta distribuida por clientes
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", backgroundColor: "var(--ots-primary-muted)", color: "var(--ots-primary)" }}>
                      Recomendado
                    </span>
                  </div>
                  <p style={{ fontSize: "12.5px", color: "var(--ots-text-secondary)", marginTop: "6px", lineHeight: "1.4" }}>
                    Cabecera única de Proveedor, Moneda y Cotización. Permite distribuir en múltiples líneas por cliente, generando operaciones individuales y actualizando saldos automáticamente en cuenta corriente.
                  </p>
                </div>

                {/* Opción 2: Operación Estándar 1 a 1 */}
                <div
                  onClick={() => {
                    setIsTypeSelectorOpen(false);
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
                  style={{
                    backgroundColor: "var(--ots-surface-inset)",
                    border: "1px solid var(--ots-border)",
                    borderRadius: "var(--ots-radius-md)",
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--ots-surface-2)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "var(--ots-surface-inset)")}
                >
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--ots-text-primary)" }}>
                    2. Operación Estándar (1 a 1)
                  </span>
                  <p style={{ fontSize: "12.5px", color: "var(--ots-text-secondary)", marginTop: "6px", lineHeight: "1.4" }}>
                    Registro individual directo entre un único cliente y un proveedor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 2: FORMULARIO VENTA DISTRIBUIDA POR CLIENTES (TIPO 1) */}
      {/* --------------------------------------------------------- */}
      {isDistributedModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => { setIsDistributedModalOpen(false); setEditingId(null); }}>
            <div
              className="flowbite-drawer"
              style={{
                backgroundColor: "var(--ots-surface-1)",
                border: "1px solid var(--ots-border)",
                borderRadius: "var(--ots-radius-lg)",
                width: "95%",
                maxWidth: "1150px",
                maxHeight: "92vh",
                display: "flex",
                flexDirection: "column",
                margin: "auto",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--ots-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "var(--ots-surface-2)",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ots-primary)", letterSpacing: "0.08em" }}>
                    TIPO 1
                  </span>
                  <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--ots-text-primary)", marginTop: "2px" }}>
                    Venta Distribuida por Clientes
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsDistributedModalOpen(false); setEditingId(null); }}
                  style={{ background: "none", border: "none", color: "var(--ots-text-muted)", fontSize: "20px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Form */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                <form id="distributed-form" onSubmit={handleSaveDistributedSale}>
                  {/* SECCIÓN CABECERA */}
                  <div
                    style={{
                      backgroundColor: "var(--ots-surface-inset)",
                      border: "1px solid var(--ots-border)",
                      borderRadius: "var(--ots-radius-md)",
                      padding: "18px",
                      marginBottom: "24px",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ots-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "14px" }}>
                      1. Cabecera de la Operación
                    </span>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "16px" }}>
                      {/* Proveedor */}
                      <div className="flowbite-form-group">
                        <label className="flowbite-form-label">Proveedor *</label>
                        <LiquidSelect
                          value={distributedData.providerId}
                          onChange={(val) => setDistributedData({ ...distributedData, providerId: val })}
                          placeholder="Seleccionar Proveedor..."
                          required
                          options={providers.map((p) => ({ value: p.id, label: p.name }))}
                        />
                      </div>

                      {/* Moneda */}
                      <div className="flowbite-form-group">
                        <label className="flowbite-form-label">Moneda *</label>
                        <LiquidSelect
                          value={distributedData.currencyId}
                          onChange={(val) => setDistributedData({ ...distributedData, currencyId: val })}
                          placeholder="Seleccionar Moneda..."
                          required
                          options={currencies.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                        />
                      </div>

                      {/* Cotización Proveedor */}
                      <div className="flowbite-form-group">
                        <label className="flowbite-form-label">Cotización Proveedor (Costo en ARS) *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={distributedData.exchangeRate}
                          onChange={(e) => setDistributedData({ ...distributedData, exchangeRate: e.target.value })}
                          className="flowbite-input"
                          placeholder="ej: 1500.00"
                        />
                      </div>

                      {/* Fecha */}
                      <div className="flowbite-form-group">
                        <label className="flowbite-form-label">Fecha Operativa *</label>
                        <input
                          type="date"
                          required
                          value={distributedData.operationDate}
                          onChange={(e) => setDistributedData({ ...distributedData, operationDate: e.target.value })}
                          className="flowbite-input"
                        />
                      </div>
                    </div>

                    {/* Observaciones generales */}
                    <div className="flowbite-form-group" style={{ marginTop: "14px" }}>
                      <label className="flowbite-form-label">Observaciones Generales de Cabecera</label>
                      <input
                        type="text"
                        value={distributedData.observations}
                        onChange={(e) => setDistributedData({ ...distributedData, observations: e.target.value })}
                        className="flowbite-input"
                        placeholder="ej: Lote distribuido turno mañana..."
                      />
                    </div>
                  </div>

                  {/* SECCIÓN DETALLE / LÍNEAS POR CLIENTE */}
                  <div
                    style={{
                      backgroundColor: "var(--ots-surface-inset)",
                      border: "1px solid var(--ots-border)",
                      borderRadius: "var(--ots-radius-md)",
                      padding: "18px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ots-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        2. Detalle de Clientes & Montos
                      </span>
                      <button
                        type="button"
                        onClick={handleAddDistributedItem}
                        className="flowbite-btn flowbite-btn-primary"
                        style={{ padding: "6px 14px", fontSize: "12px" }}
                      >
                        + Agregar línea
                      </button>
                    </div>

                    {/* Tabla Dinámica de Líneas */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--ots-border)", color: "var(--ots-text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
                            <th style={{ padding: "8px", textAlign: "left", width: "25%" }}>Cliente *</th>
                            <th style={{ padding: "8px", textAlign: "left", width: "16%" }}>Cotización Cliente</th>
                            <th style={{ padding: "8px", textAlign: "left", width: "17%" }}>Monto *</th>
                            <th style={{ padding: "8px", textAlign: "left", width: "24%" }}>Observaciones</th>
                            <th style={{ padding: "8px", textAlign: "center", width: "10%" }}>Pagado</th>
                            <th style={{ padding: "8px", textAlign: "center", width: "8%" }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {distributedData.items.map((item, index) => (
                            <tr key={index} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <td style={{ padding: "8px" }}>
                                <LiquidSelect
                                  value={item.clientId}
                                  onChange={(val) => handleDistributedItemChange(index, "clientId", val)}
                                  placeholder="Cliente..."
                                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                                />
                              </td>
                              <td style={{ padding: "8px" }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.exchangeRate}
                                  onChange={(e) => handleDistributedItemChange(index, "exchangeRate", e.target.value)}
                                  className="flowbite-input"
                                  placeholder={distributedData.exchangeRate || "1500"}
                                  style={{ fontFamily: "var(--ots-font-mono)" }}
                                />
                              </td>
                              <td style={{ padding: "8px" }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  value={item.amount}
                                  onChange={(e) => handleDistributedItemChange(index, "amount", e.target.value)}
                                  className="flowbite-input"
                                  placeholder="0.00"
                                  style={{ fontFamily: "var(--ots-font-mono)" }}
                                />
                              </td>
                              <td style={{ padding: "8px" }}>
                                <input
                                  type="text"
                                  value={item.observations}
                                  onChange={(e) => handleDistributedItemChange(index, "observations", e.target.value)}
                                  className="flowbite-input"
                                  placeholder="Notas..."
                                />
                              </td>
                              <td style={{ padding: "8px", textAlign: "center" }}>
                                <select
                                  value={item.isPaid ? "true" : "false"}
                                  onChange={(e) => handleDistributedItemChange(index, "isPaid", e.target.value === "true")}
                                  className="flowbite-input"
                                  style={{ padding: "6px", fontSize: "12px" }}
                                >
                                  <option value="true">Sí (Pagado)</option>
                                  <option value="false">No (Fiado)</option>
                                </select>
                              </td>
                              <td style={{ padding: "8px", textAlign: "center" }}>
                                {distributedData.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDistributedItem(index)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "var(--ots-danger)",
                                      cursor: "pointer",
                                      fontSize: "16px",
                                    }}
                                    title="Eliminar línea"
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer Summary & Actions */}
              <div
                style={{
                  padding: "18px 24px",
                  borderTop: "1px solid var(--ots-border)",
                  backgroundColor: "var(--ots-surface-2)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div>
                  {(() => {
                    const headerRate = parseFloat(distributedData.exchangeRate) || 0;
                    const totalMonto = distributedData.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                    const costProveedorARS = totalMonto * headerRate;
                    const totalVentaClientesARS = distributedData.items.reduce((s, i) => {
                      const amount = parseFloat(i.amount) || 0;
                      const lineRate = i.exchangeRate && !isNaN(parseFloat(i.exchangeRate)) ? parseFloat(i.exchangeRate) : headerRate;
                      return s + (amount * lineRate);
                    }, 0);
                    const selectedCur = currencies.find((c) => c.id === distributedData.currencyId);
                    const gananciaNetaARS = totalVentaClientesARS - costProveedorARS;
                    return (
                      <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--ots-text-muted)", textTransform: "uppercase", display: "block" }}>Total Comprado</span>
                          <strong style={{ fontSize: "15px", fontFamily: "var(--ots-font-mono)", color: "var(--ots-text-primary)" }}>
                            {totalMonto.toLocaleString()} {selectedCur?.code || ""}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--ots-text-muted)", textTransform: "uppercase", display: "block" }}>Costo Proveedor ARS</span>
                          <strong style={{ fontSize: "15px", fontFamily: "var(--ots-font-mono)", color: "var(--ots-warning)" }}>
                            $ {costProveedorARS.toLocaleString()} ARS
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--ots-text-muted)", textTransform: "uppercase", display: "block" }}>Total Ventas Clientes ARS</span>
                          <strong style={{ fontSize: "15px", fontFamily: "var(--ots-font-mono)", color: "var(--ots-success)" }}>
                            $ {totalVentaClientesARS.toLocaleString()} ARS
                          </strong>
                        </div>
                        <div style={{ borderLeft: "1px solid var(--ots-border)", paddingLeft: "24px" }}>
                          <span style={{ fontSize: "11px", color: "var(--ots-text-muted)", textTransform: "uppercase", display: "block", fontWeight: 700 }}>Ganancia Operativa ARS</span>
                          <strong style={{ fontSize: "16px", fontFamily: "var(--ots-font-mono)", color: gananciaNetaARS >= 0 ? "var(--ots-success)" : "var(--ots-danger)" }}>
                            $ {gananciaNetaARS.toLocaleString()} ARS
                          </strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => { setIsDistributedModalOpen(false); setEditingId(null); }}
                    className="flowbite-btn flowbite-btn-text"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="distributed-form"
                    disabled={isSubmittingDistributed}
                    className="flowbite-btn flowbite-btn-primary"
                  >
                    {isSubmittingDistributed ? "Guardando..." : "Guardar Operación Agrupadora"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

    </>
  );
}
