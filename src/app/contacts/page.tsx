"use client";

import { useState, useEffect } from "react";
import Portal from "@/components/Portal";
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [filterType, setFilterType] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    document: "",
    email: "",
    isClient: true,
    isProvider: false,
    tagIds: [] as string[],
  });

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.contacts) {
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (data.tags) setAvailableTags(data.tags);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchContacts();
    fetchTags();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/contacts/${editingId}` : "/api/contacts";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: "", document: "", email: "", isClient: true, isProvider: false, tagIds: [] });
        fetchContacts();
      } else {
        alert("Error al guardar contacto");
      }
    } catch (error) {
      alert("Error de red");
    }
  };

  const handleEdit = (contact: any) => {
    const tagIds = contact.tags ? availableTags.filter((t) => contact.tags.includes(t.name)).map((t) => t.id) : [];

    setFormData({
      name: contact.name,
      document: contact.document || "",
      email: contact.email || "",
      isClient: contact.isClient,
      isProvider: contact.isProvider,
      tagIds,
    });
    setEditingId(contact.id);
    setIsModalOpen(true);
  };

  const handleArchive = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas archivar este contacto?")) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (res.ok) fetchContacts();
      else alert("Error al archivar");
    } catch (error) {
      alert("Error de red");
    }
  };

  const filtered = contacts.filter((c) => {
    if (filterType === "CLIENT" && !c.isClient) return false;
    if (filterType === "PROVIDER" && !c.isProvider) return false;

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(term);
      const matchDoc = c.document?.toLowerCase().includes(term);
      const matchEmail = c.email?.toLowerCase().includes(term);

      if (!matchName && !matchDoc && !matchEmail) return false;
    }

    return true;
  });

  return (
    <>
      <div className="animate-fade-in" style={{ padding: "1rem 0" }}>
        {/* Page Title & Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <span className="section-eyebrow">ENTIDADES & CLIENTES</span>
          <h1 className="flowbite-title">Directorio de Contactos</h1>
          <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
            Gestión unificada de clientes y proveedores involucrados en las operaciones del portal.
          </p>
        </div>

        {/* Flowbite Style Table Header */}
        <div className="flowbite-table-header" style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "space-between" }}>
          {/* Left side: Search input */}
          <div className="flowbite-search-container" style={{ width: "100%", maxWidth: "400px" }}>
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
              placeholder="Buscar por nombre, documento o email..."
              style={{ width: "100%" }}
              required
            />
          </div>

          {/* Right side: Action buttons */}
          <div className="flowbite-actions-bar" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {/* Add New Contact Button */}
            <button
              type="button"
              className="flowbite-btn flowbite-btn-primary"
              onClick={() => {
                setEditingId(null);
                setFormData({ name: "", document: "", email: "", isClient: true, isProvider: false, tagIds: [] });
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
                  d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"
                />
              </svg>
              Nuevo Contacto
            </button>

            {/* Filter Dropdown Button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="flowbite-btn"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="w-4 h-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  style={{ width: "16px", height: "16px", color: "var(--text-secondary)" }}
                >
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                    clipRule="evenodd"
                  />
                </svg>
                Clasificación
                <svg
                  className="w-4 h-4 ml-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ width: "14px", height: "14px" }}
                >
                  <path
                    clipRule="evenodd"
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isFilterDropdownOpen && (
                <div
                  className="flowbite-nav-dropdown-menu flowbite-dropdown-animate"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: "180px",
                    zIndex: 10,
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-light)", padding: "4px 12px" }}>
                    MOSTRAR SOLO:
                  </span>
                  <label
                    className="flowbite-nav-dropdown-item"
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <input
                      type="radio"
                      name="filter-type"
                      checked={filterType === "ALL"}
                      onChange={() => {
                        setFilterType("ALL");
                        setIsFilterDropdownOpen(false);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <span>Todos</span>
                  </label>
                  <label
                    className="flowbite-nav-dropdown-item"
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <input
                      type="radio"
                      name="filter-type"
                      checked={filterType === "CLIENT"}
                      onChange={() => {
                        setFilterType("CLIENT");
                        setIsFilterDropdownOpen(false);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <span>Clientes</span>
                  </label>
                  <label
                    className="flowbite-nav-dropdown-item"
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <input
                      type="radio"
                      name="filter-type"
                      checked={filterType === "PROVIDER"}
                      onChange={() => {
                        setFilterType("PROVIDER");
                        setIsFilterDropdownOpen(false);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <span>Proveedores</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Table (Hidden on Mobile) */}
        <div className="flowbite-desktop-table-container">
          <LiquidTableContainer style={{ margin: 0 }}>
            <LiquidTable hover size="md">
              <LiquidTableHead>
                <LiquidTableRow>
                  <LiquidTableHeaderCell style={{ width: "25%" }}>Nombre / Razón Social</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "15%" }}>Documento/CUIT</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "20%" }}>Clasificación</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "20%" }}>Etiquetas</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "10%" }}>Estado</LiquidTableHeaderCell>
                  <LiquidTableHeaderCell style={{ width: "10%" }} align="right">Acciones</LiquidTableHeaderCell>
                </LiquidTableRow>
              </LiquidTableHead>
              <LiquidTableBody>
                {loading ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={6} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      Cargando contactos...
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : filtered.length === 0 ? (
                  <LiquidTableRow>
                    <LiquidTableCell colSpan={6} align="center" style={{ padding: "24px", color: "var(--text-secondary)" }}>
                      No se encontraron contactos en esta vista.
                    </LiquidTableCell>
                  </LiquidTableRow>
                ) : (
                  filtered.map((contact) => (
                    <LiquidTableRow key={contact.id}>
                      <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>{contact.name}</LiquidTableCell>
                      <LiquidTableCell style={{ fontFamily: "monospace" }}>{contact.document || "-"}</LiquidTableCell>
                      <LiquidTableCell>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {contact.isClient && <span className="flowbite-badge flowbite-badge-blue">Cliente</span>}
                          {contact.isProvider && <span className="flowbite-badge flowbite-badge-yellow">Proveedor</span>}
                        </div>
                      </LiquidTableCell>
                      <LiquidTableCell>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map((tag: any) => {
                              const dbTag = availableTags.find((t) => t.name === tag);
                              const tagColor = dbTag ? dbTag.color : "var(--text-secondary)";
                              
                              return (
                                <span
                                  key={tag}
                                  className="flowbite-badge"
                                  style={{
                                    backgroundColor: dbTag ? `${tagColor}20` : "var(--hover-bg)",
                                    color: tagColor,
                                    border: `1px solid ${tagColor}40`,
                                    fontSize: "12px",
                                    padding: "2px 8px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {tag}
                                </span>
                              );
                            })
                          ) : (
                            <span style={{ color: "var(--text-light)", fontSize: "13px" }}>-</span>
                          )}
                        </div>
                      </LiquidTableCell>
                      <LiquidTableCell>
                        <span className={`flowbite-badge ${contact.isActive ? "flowbite-badge-green" : "flowbite-badge-red"}`}>
                          {contact.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </LiquidTableCell>
                      <LiquidTableCell align="right">
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                          <LiquidMenu
                            align="end"
                            items={[
                              {
                                label: "Modificar Ficha",
                                icon: (
                                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: "16px", height: "16px" }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                ),
                                onSelect: () => handleEdit(contact)
                              },
                              { type: "separator" },
                              {
                                label: "Archivar Contacto",
                                icon: (
                                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: "16px", height: "16px" }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                ),
                                danger: true,
                                onSelect: () => handleArchive(contact.id)
                              }
                            ]}
                            trigger={
                              <button
                                className="flowbite-btn"
                                style={{ padding: "6px 10px", fontSize: "14px", minWidth: "36px", height: "36px" }}
                                title="Acciones"
                              >
                                <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: "16px", height: "16px" }}>
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                              </button>
                            }
                          />
                        </div>
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
              Cargando contactos...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              No se encontraron contactos en esta vista.
            </div>
          ) : (
            filtered.map((contact) => (
              <GlassCard
                key={contact.id}
                onClick={() => handleEdit(contact)}
                style={{
                  margin: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  borderLeft: `4px solid ${contact.isActive ? "var(--primary-color)" : "#f87171"}`,
                  position: "relative",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {contact.name}
                    </h3>
                    {contact.document && (
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                        Doc: {contact.document}
                      </span>
                    )}
                  </div>
                  <span className={`flowbite-badge ${contact.isActive ? "flowbite-badge-green" : "flowbite-badge-red"}`}>
                    {contact.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {contact.isClient && <span className="flowbite-badge flowbite-badge-blue">Cliente</span>}
                    {contact.isProvider && <span className="flowbite-badge flowbite-badge-yellow">Proveedor</span>}
                  </div>

                  {contact.tags && contact.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      {contact.tags.map((tag: any) => {
                        const dbTag = availableTags.find((t) => t.name === tag);
                        const tagColor = dbTag ? dbTag.color : "var(--text-secondary)";
                        return (
                          <span
                            key={tag}
                            className="flowbite-badge"
                            style={{
                              backgroundColor: dbTag ? `${tagColor}20` : "var(--hover-bg)",
                              color: tagColor,
                              border: `1px solid ${tagColor}40`,
                              fontSize: "11px",
                              padding: "2px 6px",
                              fontWeight: 600,
                            }}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "8px",
                    borderTop: "1px solid var(--border-color)",
                    paddingTop: "8px",
                    flexWrap: "wrap",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <LiquidMenu
                            align="end"
                    items={[
                      {
                        label: "Modificar Ficha",
                        icon: (
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: "16px", height: "16px" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        ),
                        onSelect: () => handleEdit(contact)
                      },
                      { type: "separator" },
                      {
                        label: "Archivar Contacto",
                        icon: (
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: "16px", height: "16px" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        ),
                        danger: true,
                        onSelect: () => handleArchive(contact.id)
                      }
                    ]}
                    trigger={
                      <button
                        className="flowbite-btn"
                        style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        Acciones
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={{ width: "12px", height: "12px" }}>
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    }
                  />
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
          <div className="flowbite-drawer" style={{ width: "100%", maxWidth: "500px", margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
            {/* Header toolbar */}
            <div className="flowbite-drawer-header" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                {editingId ? "Editar Ficha de Contacto" : "Nueva Ficha de Contacto"}
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
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
                  {/* Name Property */}
                  <div className="flowbite-form-group">
                    <label className="flowbite-form-label">Nombre *</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="flowbite-input"
                      placeholder="Nombre completo o Razón Social"
                    />
                  </div>

                  {/* Document Property */}
                  <div className="flowbite-form-group">
                    <label className="flowbite-form-label">CUIT / DNI</label>
                    <input
                      type="text"
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      className="flowbite-input"
                      placeholder="Sin guiones ni puntos"
                    />
                  </div>

                  {/* Email Property */}
                  <div className="flowbite-form-group">
                    <label className="flowbite-form-label">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="flowbite-input"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>

                  {/* Classification Property */}
                  <div className="flowbite-form-group">
                    <label className="flowbite-form-label">Clasificación</label>
                    <div style={{ display: "flex", gap: "1.5rem", marginTop: "4px", flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={formData.isClient}
                          onChange={(e) => setFormData({ ...formData, isClient: e.target.checked })}
                          style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--primary-color)" }}
                        />
                        <span className="flowbite-badge flowbite-badge-blue">Es Cliente</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={formData.isProvider}
                          onChange={(e) => setFormData({ ...formData, isProvider: e.target.checked })}
                          style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--primary-color)" }}
                        />
                        <span className="flowbite-badge flowbite-badge-yellow">Es Proveedor</span>
                      </label>
                    </div>
                  </div>

                  {/* Tags Property */}
                  <div className="flowbite-form-group" style={{ position: "relative" }}>
                    <label className="flowbite-form-label">Etiquetas</label>
                    <div
                      onClick={() => setIsTagsDropdownOpen(!isTagsDropdownOpen)}
                      className="flowbite-input"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        cursor: "pointer",
                        minHeight: "42px",
                        alignItems: "center",
                      }}
                    >
                      {formData.tagIds.length === 0 ? (
                        <span style={{ color: "var(--text-light)", fontSize: "13px" }}>Asignar etiquetas...</span>
                      ) : (
                        formData.tagIds.map((id) => {
                          const tag = availableTags.find((t) => t.id === id);
                          if (!tag) return null;
                          return (
                            <span
                              key={id}
                              className="flowbite-badge"
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                border: `1px solid ${tag.color}40`,
                                fontSize: "12px",
                                padding: "2px 8px",
                                fontWeight: 600,
                              }}
                            >
                              {tag.name}
                            </span>
                          );
                        })
                      )}
                      <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--text-secondary)" }}>▼</span>
                    </div>

                    {/* Dropdown list */}
                    {isTagsDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-lg)",
                          zIndex: 10,
                          maxHeight: "180px",
                          overflowY: "auto",
                          boxShadow: "var(--shadow-modal)",
                        }}
                      >
                        {availableTags.length === 0 ? (
                          <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                            No hay etiquetas configuradas.
                          </div>
                        ) : (
                          availableTags.map((tag) => {
                            const isSelected = formData.tagIds.includes(tag.id);
                            return (
                              <label
                                key={tag.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  borderBottom: "1px solid var(--border-color)",
                                  transition: "background-color 0.1s",
                                  backgroundColor: isSelected ? "var(--hover-bg)" : "transparent",
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--hover-bg)" : "transparent")}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({ ...formData, tagIds: [...formData.tagIds, tag.id] });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        tagIds: formData.tagIds.filter((id) => id !== tag.id),
                                      });
                                    }
                                  }}
                                  style={{ cursor: "pointer", accentColor: tag.color }}
                                />
                                <span
                                  className="flowbite-badge"
                                  style={{
                                    backgroundColor: `${tag.color}20`,
                                    color: tag.color,
                                    border: `1px solid ${tag.color}40`,
                                    fontWeight: 600,
                                  }}
                                >
                                  {tag.name}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
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
                    flexWrap: "wrap",
                  }}
                >
                  <button type="button" className="flowbite-btn flowbite-btn-text" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="flowbite-btn flowbite-btn-primary">
                    Guardar Ficha
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Portal>
      )}

    </>
  );
}
