"use client";

import { useFeedback } from "@/components/FeedbackProvider";

import { useState } from "react";
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
} from "@liquefy-ui/react";

import { formatMoney } from "@/lib/format-currency";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AccountsPage() {
  const { notify, confirm: confirmAction } = useFeedback();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    contactId: "",
    currencyId: "",
    type: "DEBIT",
    amount: "",
    concept: "",
    observations: "",
  });

  const { data: accountsData, isLoading: loading, mutate: fetchData } = useSWR("/api/accounts", fetcher);
  const { data: contactsData } = useSWR("/api/contacts", fetcher);
  const { data: currenciesData } = useSWR("/api/currencies", fetcher);

  const accounts = accountsData?.accounts || [];
  const contacts = contactsData?.contacts || [];
  const currencies = currenciesData?.currencies || [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        notify("Movimiento guardado correctamente.", "success");
        fetchData();
        setFormData({
          contactId: "",
          currencyId: "",
          type: "DEBIT",
          amount: "",
          concept: "",
          observations: "",
        });
      } else {
        notify("Error al guardar el movimiento");
      }
    } catch (error) {
      notify("Error de red");
    }
  };

  const openHistory = async (account: any) => {
    setSelectedAccount(account);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}/transactions`);
      const data = await res.json();
      if (data.transactions) setTransactions(data.transactions);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((acc: any) => {
    if (searchTerm.trim() !== "") {
      return acc.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  return (
    <>
      <div className="animate-fade-in" style={{ padding: "1rem 0" }}>
        {/* Page Title & Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <span className="section-eyebrow">LIBRO MAYOR & SALDOS</span>
          <h1 className="flowbite-title">Cuentas Corrientes</h1>
          <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
            Registro y conciliación de saldos por moneda para cada cliente o proveedor.
          </p>
        </div>

        {/* Flowbite Style Table Header */}
        <div className="flowbite-table-header" style={{ flexWrap: "wrap" }}>
          {/* Left side: Search input */}
          <div className="flowbite-search-container">
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
              placeholder="Buscar por contacto..."
              required
            />
          </div>

          {/* Right side: Action buttons */}
          <div className="flowbite-actions-bar">
            {/* Add New Movement Button */}
            <button
              type="button"
              className="flowbite-btn flowbite-btn-primary"
              onClick={() => setIsModalOpen(true)}
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
              Nuevo Movimiento
            </button>
          </div>
        </div>

        {/* Table Database */}
        <div className="flowbite-desktop-table-container" style={{ overflowX: "auto", width: "100%" }}>
          <LiquidTableContainer style={{ margin: 0 }}>
            <LiquidTable hover size="md">
              <LiquidTableHead>
                <LiquidTableRow>
                  <LiquidTableHeaderCell style={{ width: "35%" }}>Contacto</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "20%" }}>Tipo</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "15%" }}>Moneda</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "20%" }} align="right">Saldo Total</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "10%" }} align="right">Acciones</LiquidTableHeaderCell>
                </LiquidTableRow>
              </LiquidTableHead>
              <LiquidTableBody>
                {loading ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={5} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      Cargando cuentas corrientes...
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : filteredAccounts.length === 0 ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={5} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      No se encontraron cuentas corrientes.
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : (
                  filteredAccounts.map((acc) => (
                    <LiquidTableRow key={acc.id}>
                      <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>{acc.contact?.name}</LiquidTableCell>
                      <LiquidTableCell>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {acc.contact?.isClient && <span className="flowbite-badge flowbite-badge-blue">Cliente</span>}
                          {acc.contact?.isProvider && <span className="flowbite-badge flowbite-badge-yellow">Proveedor</span>}
                        </div>
                      </LiquidTableCell>
                      <LiquidTableCell>
                        <span
                          className={`flowbite-badge ${
                            acc.currency?.code === "USD"
                              ? "flowbite-badge-green"
                              : acc.currency?.code === "EUR"
                              ? "flowbite-badge-blue"
                              : "flowbite-badge-yellow"
                          }`}
                          style={{ minWidth: "46px", justifyContent: "center" }}
                        >
                          {acc.currency?.code}
                        </span>
                      </LiquidTableCell>
                      <LiquidTableCell align="right">
                        <span
                          style={{
                            fontWeight: 700,
                            fontFamily: "var(--font-jetbrains-mono), monospace",
                            fontSize: "14.5px",
                            color: acc.balance >= 0 ? "var(--badge-green-text)" : "var(--badge-red-text)",
                            backgroundColor: acc.balance >= 0 ? "var(--badge-green-bg)" : "var(--badge-red-bg)",
                            padding: "4px 10px",
                            borderRadius: "var(--ots-radius-sm)",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          {new Intl.NumberFormat("es-AR", { style: "currency", currency: acc.currency?.code }).format(acc.balance)}
                        </span>
                      </LiquidTableCell>
                      <LiquidTableCell align="right">
                        <button
                          onClick={() => openHistory(acc)}
                          className="flowbite-btn flowbite-btn-text"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          Mayor
                        </button>
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
              Cargando cuentas corrientes...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              No se encontraron cuentas corrientes.
            </div>
          ) : (
            filteredAccounts.map((acc) => (
              <GlassCard
                key={acc.id}
                onClick={() => openHistory(acc)}
                style={{
                  margin: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  borderLeft: `4px solid ${acc.balance >= 0 ? "var(--badge-green-text)" : "var(--badge-red-text)"}`,
                  position: "relative",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {acc.contact?.name}
                    </h3>
                    <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                      {acc.contact?.isClient && <span className="flowbite-badge flowbite-badge-blue">Cliente</span>}
                      {acc.contact?.isProvider && <span className="flowbite-badge flowbite-badge-yellow">Proveedor</span>}
                    </div>
                  </div>
                  <span
                    className={`flowbite-badge ${
                      acc.currency?.code === "USD"
                        ? "flowbite-badge-green"
                        : acc.currency?.code === "EUR"
                        ? "flowbite-badge-blue"
                        : "flowbite-badge-yellow"
                    }`}
                    style={{ minWidth: "46px", justifyContent: "center" }}
                  >
                    {acc.currency?.code}
                  </span>
                </div>

                {/* Balance & Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", flexWrap: "wrap", gap: "8px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontFamily: "monospace",
                      fontSize: "15px",
                      color: acc.balance >= 0 ? "var(--badge-green-text)" : "var(--badge-red-text)",
                      backgroundColor: acc.balance >= 0 ? "var(--badge-green-bg)" : "var(--badge-red-bg)",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: acc.currency?.code }).format(acc.balance)}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openHistory(acc);
                    }}
                    className="flowbite-btn flowbite-btn-text"
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                  >
                    Mayor
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>

      {/* Slide-out Peek Modal for manual movement registration */}
      {/* Slide-out Peek Modal for manual movement registration */}
      {isModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsModalOpen(false)}>
            <div
              className="flowbite-drawer"
              style={{
                width: "100%",
                maxWidth: "680px",
                backgroundColor: "var(--ots-surface-1)",
                borderRadius: "var(--ots-radius-lg)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flowbite-drawer-header" style={{ padding: "1.25rem 1.75rem" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ots-primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    CUENTAS CORRIENTES
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ots-text-primary)", margin: "2px 0 0 0" }}>
                    Registrar Ajuste Contable
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
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
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--ots-surface-2)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  ✕
                </button>
              </div>

              <div className="flowbite-drawer-body" style={{ padding: "1.75rem" }}>
                <form onSubmit={handleSave}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Contact Property */}
                    <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                      <label className="flowbite-form-label">Contacto / Entidad *</label>
                      <LiquidSelect
                        value={formData.contactId}
                        onChange={(val) => setFormData({ ...formData, contactId: val })}
                        placeholder="Seleccione un cliente o proveedor..."
                        required
                        options={contacts.map((c) => ({
                          value: c.id,
                          label: c.name,
                          sublabel: c.isClient && c.isProvider ? "Cliente / Proveedor" : c.isClient ? "Cliente" : c.isProvider ? "Proveedor" : undefined,
                        }))}
                      />
                    </div>

                    {/* Currency and Type in Grid */}
                    <div className="flowbite-form-grid">
                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <label className="flowbite-form-label">Moneda *</label>
                        <LiquidSelect
                          value={formData.currencyId}
                          onChange={(val) => setFormData({ ...formData, currencyId: val })}
                          placeholder="Seleccione moneda..."
                          required
                          options={currencies.map((c) => ({
                            value: c.id,
                            label: `${c.code} (${c.name || c.symbol})`,
                          }))}
                        />
                      </div>
                      <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                        <label className="flowbite-form-label">Tipo de Movimiento *</label>
                        <LiquidSelect
                          value={formData.type}
                          onChange={(val) => setFormData({ ...formData, type: val })}
                          options={[
                            { value: "DEBIT", label: "Débito (+) / Incrementa Saldo" },
                            { value: "CREDIT", label: "Crédito (-) / Reduce Saldo" },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Amount Property */}
                    <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                      <label className="flowbite-form-label">Monto a Ajustar *</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="flowbite-input"
                        placeholder="0.00"
                        style={{ width: "100%", fontSize: "15px" }}
                      />
                    </div>

                    {/* Concept Property */}
                    <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                      <label className="flowbite-form-label">Concepto del Movimiento *</label>
                      <input
                        required
                        type="text"
                        placeholder="Ej: Ajuste de saldo manual, Pago a cuenta, Saldo inicial..."
                        value={formData.concept}
                        onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                        className="flowbite-input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    {/* Observations Property */}
                    <div className="flowbite-form-group" style={{ marginBottom: 0 }}>
                      <label className="flowbite-form-label">Observaciones o Notas Adicionales</label>
                      <textarea
                        rows={3}
                        value={formData.observations}
                        onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                        className="flowbite-input"
                        placeholder="Detalles complementarios de la transacción..."
                        style={{ fontFamily: "inherit", resize: "vertical", width: "100%", minHeight: "80px" }}
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
                      onClick={() => setIsModalOpen(false)}
                      style={{ padding: "9px 18px" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flowbite-btn flowbite-btn-primary"
                      style={{ padding: "9px 22px" }}
                    >
                      Registrar Movimiento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Slide-out Peek Modal for Account Ledger (Mayor Contable) */}
      {isHistoryModalOpen && selectedAccount && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="flowbite-drawer" style={{ maxWidth: "750px", width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="flowbite-drawer-header">
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                Mayor Contable: {selectedAccount.contact?.name} ({selectedAccount.currency?.code})
              </span>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
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

            <div className="flowbite-drawer-body">
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>
                  Historial de Movimientos
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  Detalle contable acumulativo para la cuenta seleccionada.
                </p>
              </div>

              {/* Transactions Flowbite Table */}
              <div className="flowbite-desktop-table-container" style={{ overflowX: "auto", width: "100%" }}>
                <LiquidTableContainer style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto", margin: 0 }}>
                  <LiquidTable hover size="md">
                    <LiquidTableHead>
                      <LiquidTableRow>
                        <LiquidTableHeaderCell style={{ width: "25%" }}>Fecha</LiquidTableHeaderCell>
                        <LiquidTableHeaderCell style={{ width: "35%" }}>Concepto</LiquidTableHeaderCell>
                        <LiquidTableHeaderCell style={{ width: "15%" }} align="right">Débito (+)</LiquidTableHeaderCell>
                        <LiquidTableHeaderCell style={{ width: "15%" }} align="right">Crédito (-)</LiquidTableHeaderCell>
                        <LiquidTableHeaderCell style={{ width: "10%" }} align="right">Saldo</LiquidTableHeaderCell>
                      </LiquidTableRow>
                    </LiquidTableHead>
                    <LiquidTableBody>
                      {historyLoading ? (
                        <LiquidTableRow>
                          <LiquidTableCell colSpan={5} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                            Cargando movimientos...
                          </LiquidTableCell>
                        </LiquidTableRow>
                      ) : transactions.length === 0 ? (
                        <LiquidTableRow>
                          <LiquidTableCell colSpan={5} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                            No hay movimientos registrados para esta cuenta.
                          </LiquidTableCell>
                        </LiquidTableRow>
                      ) : (
                        transactions.map((tx) => (
                          <LiquidTableRow key={tx.id}>
                            <LiquidTableCell style={{ fontSize: "13px" }}>{new Date(tx.date).toLocaleString()}</LiquidTableCell>
                            <LiquidTableCell style={{ fontWeight: 500 }}>{tx.concept}</LiquidTableCell>
                            <LiquidTableCell
                              align="right"
                              style={{
                                fontFamily: "monospace",
                                fontSize: "14px",
                                color: tx.debit > 0 ? "var(--badge-green-text)" : "inherit",
                                backgroundColor: tx.debit > 0 ? "var(--badge-green-bg)" : "transparent",
                                fontWeight: tx.debit > 0 ? 700 : "normal",
                              }}
                            >
                              {tx.debit > 0 ? formatMoney(tx.debit, 2) : "-"}
                            </LiquidTableCell>
                            <LiquidTableCell
                              align="right"
                              style={{
                                fontFamily: "monospace",
                                fontSize: "14px",
                                color: tx.credit > 0 ? "var(--badge-red-text)" : "inherit",
                                backgroundColor: tx.credit > 0 ? "var(--badge-red-bg)" : "transparent",
                                fontWeight: tx.credit > 0 ? 700 : "normal",
                              }}
                            >
                              {tx.credit > 0 ? formatMoney(tx.credit, 2) : "-"}
                            </LiquidTableCell>
                            <LiquidTableCell align="right" style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "14px" }}>
                              {formatMoney(tx.balance, 2)}
                            </LiquidTableCell>
                          </LiquidTableRow>
                        ))
                      )}
                    </LiquidTableBody>
                  </LiquidTable>
                </LiquidTableContainer>
              </div>

              {/* Transactions Mobile Cards List */}
              <div className="flowbite-mobile-card-list" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
                {historyLoading ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                    Cargando movimientos...
                  </div>
                ) : transactions.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                    No hay movimientos registrados para esta cuenta.
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <GlassCard
                      key={tx.id}
                      style={{
                        margin: 0,
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        borderLeft: `4px solid ${
                          tx.debit > 0 ? "var(--badge-green-text)" : tx.credit > 0 ? "var(--badge-red-text)" : "var(--border-color-medium)"
                        }`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {new Date(tx.date).toLocaleString()}
                        </span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {tx.debit > 0 && <span className="flowbite-badge flowbite-badge-green">+{formatMoney(tx.debit, 2)}</span>}
                          {tx.credit > 0 && <span className="flowbite-badge flowbite-badge-red">-{formatMoney(tx.credit, 2)}</span>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{tx.concept}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "4px", flexWrap: "wrap", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Saldo:</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                          {formatMoney(tx.balance, 2)}
                        </span>
                      </div>
                    </GlassCard>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Portal>
      )}
    </>
  );
}
