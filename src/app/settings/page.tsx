"use client";

import { useFeedback } from "@/components/FeedbackProvider";

import { useState, useEffect } from "react";
import Link from "next/link";
import Portal from "@/components/Portal";
import LiquidSelect from "@/components/LiquidSelect";
import ThemePreference from "@/components/ThemePreference";
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

export default function SettingsPage() {
  const { notify, confirm: confirmAction } = useFeedback();
  const [tags, setTags] = useState<any[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [editingTag, setEditingTag] = useState<any>(null);

  // Estados para Ajustes del Sistema
  const [mainCurrencyId, setMainCurrencyId] = useState("");
  const [accountingBlockDate, setAccountingBlockDate] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Estados para Monedas
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<any>(null);
  const [currencyFormData, setCurrencyFormData] = useState({
    code: "",
    name: "",
    symbol: "",
    decimals: 2,
    color: "#3b82f6",
  });
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  // Estados para Modal de Borrado de Monedas
  const [isAdminPromptOpen, setIsAdminPromptOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPromptError, setAdminPromptError] = useState<string | null>(null);
  const [currencyToDelete, setCurrencyToDelete] = useState<any>(null);

  // Estados para Administración de Usuarios
  const [users, setUsers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userFormData, setUserFormData] = useState({
    username: "",
    role: "OPERATOR",
    password: "",
    theme: "SYSTEM",
  });
  const [userError, setUserError] = useState<string | null>(null);

  // Estados para Mi Perfil
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profileUsername, setProfileUsername] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileTheme, setProfileTheme] = useState("SYSTEM");
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);

  const fetchTags = async () => {
    const res = await fetch("/api/tags");
    const data = await res.json();
    if (data.tags) setTags(data.tags);
  };

  const fetchCurrencies = async () => {
    const res = await fetch("/api/currencies");
    const data = await res.json();
    if (data.currencies) setCurrencies(data.currencies);
  };

  const handleSaveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrencyError(null);

    const url = editingCurrency ? `/api/currencies/${editingCurrency.id}` : "/api/currencies";
    const method = editingCurrency ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currencyFormData),
      });

      const data = await res.json();

      if (res.ok) {
        setIsCurrencyModalOpen(false);
        setEditingCurrency(null);
        setCurrencyFormData({ code: "", name: "", symbol: "", decimals: 2, color: "#3b82f6" });
        fetchCurrencies();
      } else {
        setCurrencyError(data.error || "Error al guardar la moneda");
      }
    } catch (err) {
      setCurrencyError("Error de red");
    }
  };

  const handleEditCurrency = (currency: any) => {
    setEditingCurrency(currency);
    setCurrencyFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimals: currency.decimals,
      color: currency.color || "#3b82f6",
    });
    setCurrencyError(null);
    setIsCurrencyModalOpen(true);
  };

  const handleDeleteCurrency = async (currency: any) => {
    setCurrencyToDelete(currency);
    setIsAdminPromptOpen(true);
    setAdminPasswordInput("");
    setAdminPromptError(null);
  };

  const handleVerifyAdminPasswordForDeletion = async () => {
    setAdminPromptError(null);
    try {
      const verifyRes = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        setAdminPromptError("Contraseña de administrador incorrecta.");
        return;
      }

      const res = await fetch(`/api/currencies/${currencyToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        fetchCurrencies();
        setIsAdminPromptOpen(false);
        setCurrencyToDelete(null);
      } else {
        setAdminPromptError(data.error || "No se pudo eliminar la moneda");
      }
    } catch (err) {
      setAdminPromptError("Error de red");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (e) {
      setIsAdmin(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.error("Failed to fetch current user info", e);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          if (data.settings.mainCurrencyId) {
            setMainCurrencyId(data.settings.mainCurrencyId);
          }
          if (data.settings.accountingBlockDate) {
            const iso = new Date(data.settings.accountingBlockDate).toISOString().split("T")[0];
            setAccountingBlockDate(iso);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch system settings", e);
    }
  };

  const handleSaveSystemSettings = async () => {
    setSettingsError(null);
    setSettingsSuccess(null);
    setSettingsLoading(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainCurrencyId,
          accountingBlockDate: accountingBlockDate || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettingsSuccess("Ajustes del sistema guardados correctamente.");
        setTimeout(() => setSettingsSuccess(null), 4000);
      } else {
        setSettingsError(data.error || "Error al guardar los ajustes del sistema.");
      }
    } catch (err) {
      setSettingsError("Error de red al guardar los ajustes.");
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
    fetchUsers();
    fetchCurrentUser();
    fetchCurrencies();
    fetchSystemSettings();
  }, []);

  // Inicializar campos de Mi Perfil al cargar usuario
  useEffect(() => {
    if (currentUser) {
      setProfileUsername(currentUser.username);
      setProfileTheme(currentUser.theme || "SYSTEM");
      setProfilePictureUrl(currentUser.profilePicture || null);
    }
  }, [currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || themeSaving) return;
    setProfileLoading(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      let finalProfilePicture = profilePictureUrl;

      if (profilePictureFile) {
        const formData = new FormData();
        formData.append("file", profilePictureFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalProfilePicture = uploadData.url;
        } else {
          setProfileError("Error al subir la imagen");
          setProfileLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: profileUsername,
          password: profilePassword,
          theme: profileTheme,
          profilePicture: finalProfilePicture,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setProfileSuccess("Perfil actualizado con éxito. Si cambiaste tu nombre, se verá reflejado al recargar.");
        setProfilePassword("");
        setCurrentUser({ ...currentUser, username: profileUsername, theme: profileTheme, profilePicture: finalProfilePicture });
        setProfilePictureFile(null);
        setProfilePictureUrl(finalProfilePicture);
      } else {
        setProfileError(data.error || "Error al actualizar perfil");
      }
    } catch (err) {
      setProfileError("Error de conexión");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName) return;

    if (editingTag) {
      const res = await fetch(`/api/tags/${editingTag.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName, color: newTagColor }),
      });
      if (res.ok) {
        setNewTagName("");
        setNewTagColor("#3b82f6");
        setEditingTag(null);
        fetchTags();
      } else {
        const errData = await res.json();
        notify(errData.error || "Error al modificar la etiqueta");
      }
    } else {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName, color: newTagColor }),
      });
      if (res.ok) {
        setNewTagName("");
        setNewTagColor("#3b82f6");
        fetchTags();
      } else {
        const errData = await res.json();
        notify(errData.error || "Error al crear la etiqueta");
      }
    }
  };

  const handleStartEditTag = (tag: any) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color || "#3b82f6");
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setNewTagName("");
    setNewTagColor("#3b82f6");
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!(await confirmAction("La etiqueta se eliminará y se quitará de todos los contactos asociados.",
      { title: "Eliminar etiqueta", confirmLabel: "Eliminar etiqueta", danger: true }))) {
      return;
    }

    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchTags();
        if (editingTag?.id === tagId) {
          handleCancelEditTag();
        }
      } else {
        const data = await res.json();
        notify(data.error || "Error al eliminar la etiqueta");
      }
    } catch (e) {
      notify("Error de red al eliminar la etiqueta");
    }
  };

  // Guardar usuario (Crear o Modificar)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userFormData),
      });

      const data = await res.json();

      if (res.ok) {
        setIsUserModalOpen(false);
        setEditingUser(null);
        setUserFormData({ username: "", role: "OPERATOR", password: "", theme: "SYSTEM" });
        fetchUsers();
      } else {
        setUserError(data.error || "Error al procesar el usuario");
      }
    } catch (err) {
      setUserError("Error de red");
    }
  };

  // Pausar / Activar usuario
  const handleToggleActive = async (user: any) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        notify(data.error || "Error al cambiar estado");
      }
    } catch (err) {
      notify("Error de red");
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      role: user.role,
      password: "", // Contraseña vacía para no modificarla a menos que se escriba algo
      theme: user.theme || "SYSTEM",
    });
    setUserError(null);
    setIsUserModalOpen(true);
  };

  return (
    <div className="animate-fade-in" style={{ padding: "0.5rem 0" }}>
      {/* Page Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="section-eyebrow">PARÁMETROS & PREFERENCIAS</span>
          <h1 className="flowbite-title">Configuración General</h1>
          <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
            Ajustes globales del sistema y administración de etiquetas y usuarios.
          </p>
        </div>
        <button
          onClick={handleSaveSystemSettings}
          disabled={settingsLoading}
          className="flowbite-btn flowbite-btn-primary"
        >
          {settingsLoading ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>

      {settingsSuccess && (
        <div className="flowbite-alert flowbite-alert-info" style={{ marginBottom: "1.5rem" }}>
          <span>✓</span>
          <div>{settingsSuccess}</div>
        </div>
      )}

      {settingsError && (
        <div className="flowbite-alert flowbite-alert-warning" style={{ marginBottom: "1.5rem" }}>
          <span>⚠️</span>
          <div>{settingsError}</div>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flowbite-grid-2">
        {currentUser?.role === "ADMIN" && (
          <>
        {/* System Settings */}
        <GlassCard>
          <h2 className="flowbite-section-title" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
            Ajustes del Sistema
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Main Currency */}
            <div className="flowbite-form-group">
              <label className="flowbite-form-label">Moneda Principal</label>
              <select
                className="flowbite-input"
                value={mainCurrencyId}
                onChange={(e) => setMainCurrencyId(e.target.value)}
              >
                <option value="">Seleccionar moneda principal...</option>
                {currencies.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Accounting Block Date */}
            <div className="flowbite-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="flowbite-form-label" style={{ margin: 0 }}>Bloqueo Contable</label>
                {accountingBlockDate && (
                  <button
                    type="button"
                    onClick={() => setAccountingBlockDate("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#f87171",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Limpiar fecha
                  </button>
                )}
              </div>
              <input type="date" className="flowbite-input" aria-label="Fecha de bloqueo contable"
                value={accountingBlockDate}
                onChange={event => setAccountingBlockDate(event.target.value)}
              />
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
                No se podrán crear ni modificar operaciones previas a esta fecha.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Currency Management */}
        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h2 className="flowbite-section-title" style={{ margin: 0 }}>Gestión de Monedas</h2>
            <button
              type="button"
              className="flowbite-btn flowbite-btn-primary"
              style={{ padding: "6px 14px", fontSize: "13px" }}
              onClick={() => {
                setEditingCurrency(null);
                setCurrencyFormData({ code: "", name: "", symbol: "", decimals: 2, color: "#3b82f6" });
                setCurrencyError(null);
                setIsCurrencyModalOpen(true);
              }}
            >
              + Nueva Moneda
            </button>
          </div>

          {currencies.length === 0 ? (
            <div style={{ color: "var(--text-secondary)", fontSize: "13px", fontStyle: "italic" }}>
              No hay monedas configuradas.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {currencies.map((cur) => (
                <div
                  key={cur.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-color)",
                    borderLeft: `4px solid ${cur.color || "#3b82f6"}`,
                    flexWrap: "wrap",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        backgroundColor: cur.color || "#3b82f6",
                        flexShrink: 0,
                        border: "1px solid rgba(0,0,0,0.1)",
                      }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                        {cur.code}
                      </span>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", marginLeft: "8px" }}>
                        {cur.name}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-light)", marginLeft: "6px" }}>
                        ({cur.symbol})
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="flowbite-btn flowbite-btn-text"
                      onClick={() => handleEditCurrency(cur)}
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                    >
                      Modificar
                    </button>
                    <button
                      type="button"
                      className="flowbite-btn flowbite-btn-danger"
                      onClick={() => handleDeleteCurrency(cur)}
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Tag Management */}
        <GlassCard>
          <h2 className="flowbite-section-title" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
            Gestión de Etiquetas
          </h2>

          {/* Add Tag Form */}
          <form onSubmit={handleSaveTag} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "24px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <input
                type="text"
                placeholder={editingTag ? "Modificar etiqueta..." : "Nueva etiqueta..."}
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flowbite-input"
              />
            </div>
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              style={{
                width: "42px",
                height: "42px",
                padding: "0 2px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-color-medium)",
                backgroundColor: "var(--bg-card)",
                cursor: "pointer",
              }}
            />
            <button type="submit" className="flowbite-btn flowbite-btn-primary" style={{ height: "42px" }}>
              {editingTag ? "Guardar" : "Añadir"}
            </button>
            {editingTag && (
              <button
                type="button"
                className="flowbite-btn flowbite-btn-text"
                onClick={handleCancelEditTag}
                style={{ height: "42px" }}
              >
                Cancelar
              </button>
            )}
          </form>

          {/* Tags list */}
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em", marginBottom: "12px" }}>
              Etiquetas Disponibles
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {tags.length === 0 ? (
                <div style={{ color: "var(--text-secondary)", fontSize: "13px", fontStyle: "italic", width: "100%" }}>
                  No hay etiquetas configuradas.
                </div>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="flowbite-badge"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      border: `1px solid ${tag.color}40`,
                      fontSize: "13px",
                      padding: "4px 10px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      position: "relative",
                    }}
                  >
                    <span>{tag.name}</span>
                    <div className="tag-dropdown-container" style={{ display: "inline-flex", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                      <LiquidMenu
                        align="end"
                        items={[
                          { label: "✏️ Editar", onSelect: () => handleStartEditTag(tag) },
                          { type: "separator" },
                          { label: "🗑️ Eliminar", onSelect: () => handleDeleteTag(tag.id), danger: true }
                        ]}
                        trigger={
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 6px",
                              fontSize: "18px",
                              fontWeight: 800,
                              lineHeight: 1,
                              opacity: 0.7,
                              transition: "opacity 0.15s",
                              color: "inherit",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                          >
                            ⋮
                          </button>
                        }
                      />
                    </div>
                  </span>
                ))
              )}
            </div>
          </div>
        </GlassCard>
          </>
        )}

        {/* Mi Perfil (My Profile) Card */}
        <GlassCard>
          <h2 className="flowbite-section-title" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
            Mi Perfil
          </h2>
          
          {profileSuccess && (
            <div className="flowbite-alert flowbite-alert-info" style={{ padding: "10px 12px", fontSize: "13px", marginBottom: "16px" }}>
              <span></span>
              <div>{profileSuccess}</div>
            </div>
          )}
          
          {profileError && (
            <div className="flowbite-alert flowbite-alert-warning" style={{ padding: "10px 12px", fontSize: "13px", marginBottom: "16px" }}>
              <span>️</span>
              <div>{profileError}</div>
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px", flexWrap: "wrap" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "var(--hover-bg)", border: "1px solid var(--border-color)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {profilePictureFile ? (
                    <img src={URL.createObjectURL(profilePictureFile)} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : profilePictureUrl ? (
                    <img src={profilePictureUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "var(--text-light)", fontSize: "24px" }}>👤</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label className="flowbite-form-label">Foto de Perfil</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setProfilePictureFile(e.target.files[0]);
                      }
                    }}
                    className="flowbite-input"
                    style={{ padding: "8px", fontSize: "12px" }}
                    disabled={profileLoading}
                  />
                </div>
              </div>

              <div className="flowbite-form-group">
                <label className="flowbite-form-label">Nombre de Usuario</label>
                <input
                  required
                  type="text"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  className="flowbite-input"
                  disabled={profileLoading}
                />
              </div>

              {currentUser && <ThemePreference value={profileTheme} userId={currentUser.id} onChange={setProfileTheme} onSavingChange={setThemeSaving} disabled={profileLoading} />}

              <div className="flowbite-form-group">
                <label className="flowbite-form-label">Nueva Contraseña (dejar vacío para no cambiar)</label>
                <input
                  type="password"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  className="flowbite-input"
                  placeholder="••••••••"
                  disabled={profileLoading}
                />
              </div>
              
              <button
                type="submit"
                className="flowbite-btn flowbite-btn-primary"
                style={{ height: "42px", width: "100%" }}
                disabled={profileLoading || themeSaving}
              >
                {profileLoading ? "Guardando..." : themeSaving ? "Guardando tema..." : "Actualizar Mis Datos"}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>

      {/* User Management Section (Restricted to Admins) */}
      {isAdmin && (
        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h2 className="flowbite-section-title" style={{ margin: 0 }}>
              Administración de Usuarios
            </h2>
            <button
              type="button"
              className="flowbite-btn flowbite-btn-primary"
              onClick={() => {
                setEditingUser(null);
                setUserFormData({ username: "", role: "OPERATOR", password: "", theme: "SYSTEM" });
                setUserError(null);
                setIsUserModalOpen(true);
              }}
            >
              Nuevo Usuario
            </button>
          </div>

          {/* Desktop Table (Hidden on Mobile) */}
          <div className="flowbite-desktop-table-container">
            <LiquidTableContainer style={{ margin: 0 }}>
              <LiquidTable hover size="md">
                <LiquidTableHead>
                  <LiquidTableRow>
                    <LiquidTableHeaderCell>Nombre de Usuario</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Rol</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Fecha de Creación</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell>Estado</LiquidTableHeaderCell>
                    <LiquidTableHeaderCell align="right">Acciones</LiquidTableHeaderCell>
                  </LiquidTableRow>
                </LiquidTableHead>
                <LiquidTableBody>
                  {users.map((user) => (
                    <LiquidTableRow key={user.id}>
                      <LiquidTableCell style={{ fontWeight: 700, color: "var(--text-primary)" }}>{user.username}</LiquidTableCell>
                      <LiquidTableCell>
                        <span className={`flowbite-badge ${user.role === "ADMIN" ? "flowbite-badge-purple" : user.role === "AUDITOR" ? "flowbite-badge-green" : "flowbite-badge-blue"}`}>
                          {user.role}
                        </span>
                      </LiquidTableCell>
                      <LiquidTableCell>{new Date(user.createdAt).toLocaleDateString()} {new Date(user.createdAt).toLocaleTimeString()}</LiquidTableCell>
                      <LiquidTableCell>
                        <span className={`flowbite-badge ${user.isActive ? "flowbite-badge-green" : "flowbite-badge-red"}`}>
                          {user.isActive ? "Activo" : "Pausado"}
                        </span>
                      </LiquidTableCell>
                      <LiquidTableCell align="right">
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                          <Link
                            href={`/audit?userId=${user.id}`}
                            className="flowbite-btn flowbite-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", textDecoration: "none", height: "auto" }}
                          >
                            Ver Cambios
                          </Link>
                          <button
                            type="button"
                            className="flowbite-btn flowbite-btn-text"
                            onClick={() => handleEditUser(user)}
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                          >
                            ️ Modificar
                          </button>
                          <button
                            type="button"
                            className={`flowbite-btn ${user.isActive ? "flowbite-btn-danger" : "flowbite-btn-primary"}`}
                            onClick={() => handleToggleActive(user)}
                            style={{ padding: "4px 8px", fontSize: "12px", height: "auto" }}
                          >
                            {user.isActive ? "⏸ Pausar" : "▶ Activar"}
                          </button>
                        </div>
                      </LiquidTableCell>
                    </LiquidTableRow>
                  ))}
                </LiquidTableBody>
              </LiquidTable>
            </LiquidTableContainer>
          </div>

          {/* Mobile Users List (Only shown on mobile) */}
          <div className="flowbite-mobile-card-list">
            {users.map((user) => (
              <GlassCard
                key={user.id}
                onClick={() => handleEditUser(user)}
                style={{
                  margin: 0,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  borderLeft: `4px solid ${user.isActive ? "var(--primary-color)" : "#f87171"}`,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "15px" }}>{user.username}</span>
                  <span className={`flowbite-badge ${user.isActive ? "flowbite-badge-green" : "flowbite-badge-red"}`}>
                    {user.isActive ? "Activo" : "Pausado"}
                  </span>
                </div>

                {/* Info */}
                <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div>
                    <strong style={{ color: "var(--text-secondary)" }}>Rol: </strong>
                    <span className={`flowbite-badge ${user.role === "ADMIN" ? "flowbite-badge-purple" : user.role === "AUDITOR" ? "flowbite-badge-green" : "flowbite-badge-blue"}`} style={{ fontSize: "11px", padding: "2px 6px" }}>
                      {user.role}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: "var(--text-secondary)" }}>Creado: </strong>
                    <span style={{ color: "var(--text-primary)" }}>{new Date(user.createdAt).toLocaleDateString()}</span>
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
                    flexWrap: "wrap"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/audit?userId=${user.id}`}
                    className="flowbite-btn flowbite-btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", textDecoration: "none", height: "auto" }}
                  >
                    Ver Cambios
                  </Link>
                  <button
                    type="button"
                    className="flowbite-btn flowbite-btn-text"
                    onClick={() => handleEditUser(user)}
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                  >
                    ️ Modificar
                  </button>
                  <button
                    type="button"
                    className={`flowbite-btn ${user.isActive ? "flowbite-btn-danger" : "flowbite-btn-primary"}`}
                    onClick={() => handleToggleActive(user)}
                    style={{ padding: "6px 12px", fontSize: "12px", height: "auto" }}
                  >
                    {user.isActive ? "⏸ Pausar" : "▶ Activar"}
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Currency Create / Edit Drawer */}
      {isCurrencyModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsCurrencyModalOpen(false)}>
            <div className="flowbite-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="flowbite-drawer-header">
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {editingCurrency ? "Modificar Moneda" : "Nueva Moneda"}
                </span>
                <button
                  onClick={() => setIsCurrencyModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-lg)",
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="flowbite-drawer-body">
                {currencyError && (
                  <div className="flowbite-alert flowbite-alert-warning" style={{ padding: "10px 12px", fontSize: "13px", marginBottom: "16px" }}>
                    <div>{currencyError}</div>
                  </div>
                )}

                <form onSubmit={handleSaveCurrency}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Code */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Código (ej: USD, ARS, EUR) *</label>
                      <input
                        required
                        type="text"
                        maxLength={10}
                        value={currencyFormData.code}
                        onChange={(e) => setCurrencyFormData({ ...currencyFormData, code: e.target.value.toUpperCase() })}
                        className="flowbite-input"
                        placeholder="USD"
                        disabled={!!editingCurrency}
                      />
                      {editingCurrency && (
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>El código no puede modificarse.</p>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Nombre completo *</label>
                      <input
                        required
                        type="text"
                        value={currencyFormData.name}
                        onChange={(e) => setCurrencyFormData({ ...currencyFormData, name: e.target.value })}
                        className="flowbite-input"
                        placeholder="Dólar Estadounidense"
                      />
                    </div>

                    {/* Symbol & Decimals in grid */}
                    <div className="flowbite-grid-2" style={{ gap: "1rem" }}>
                      <div className="flowbite-form-group">
                        <label className="flowbite-form-label">Símbolo *</label>
                        <input
                          required
                          type="text"
                          maxLength={5}
                          value={currencyFormData.symbol}
                          onChange={(e) => setCurrencyFormData({ ...currencyFormData, symbol: e.target.value })}
                          className="flowbite-input"
                          placeholder="$"
                        />
                      </div>
                      <div className="flowbite-form-group">
                        <label className="flowbite-form-label">Decimales</label>
                        <input
                          type="number"
                          min={0}
                          max={8}
                          value={currencyFormData.decimals}
                          onChange={(e) => setCurrencyFormData({ ...currencyFormData, decimals: parseInt(e.target.value) || 0 })}
                          className="flowbite-input"
                        />
                      </div>
                    </div>

                    {/* Color */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Color de Etiqueta</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input
                          type="color"
                          value={currencyFormData.color}
                          onChange={(e) => setCurrencyFormData({ ...currencyFormData, color: e.target.value })}
                          style={{
                            width: "42px",
                            height: "42px",
                            padding: "0 2px",
                            borderRadius: "var(--radius-lg)",
                            border: "1px solid var(--border-color-medium)",
                            backgroundColor: "var(--bg-card)",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        />
                        {/* Live Preview */}
                        <span
                          className="flowbite-badge"
                          style={{
                            backgroundColor: `${currencyFormData.color}22`,
                            color: currencyFormData.color,
                            border: `1px solid ${currencyFormData.color}55`,
                            fontSize: "13px",
                            padding: "5px 12px",
                            fontWeight: 700,
                            minWidth: "60px",
                            justifyContent: "center",
                          }}
                        >
                          {currencyFormData.code || "COD"}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Vista previa</span>
                      </div>
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
                    <button type="button" className="flowbite-btn flowbite-btn-text" onClick={() => setIsCurrencyModalOpen(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="flowbite-btn flowbite-btn-primary">
                      {editingCurrency ? "Guardar Cambios" : "Crear Moneda"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* User Edit / Create Drawer */}
      {isUserModalOpen && (
        <Portal>
          <div className="flowbite-drawer-overlay" onClick={() => setIsUserModalOpen(false)}>
            <div className="flowbite-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="flowbite-drawer-header">
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {editingUser ? "Modificar Usuario" : "Nuevo Usuario"}
                </span>
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-lg)",
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="flowbite-drawer-body">
                {userError && (
                  <div className="flowbite-alert flowbite-alert-warning" style={{ padding: "10px 12px", fontSize: "13px" }}>
                    <span>️</span>
                    <div>{userError}</div>
                  </div>
                )}

                <form onSubmit={handleSaveUser}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Username */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Nombre de Usuario *</label>
                      <input
                        required
                        type="text"
                        value={userFormData.username}
                        onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                        className="flowbite-input"
                        placeholder="Ej: operator_nacho"
                      />
                    </div>

                    {/* Password */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">
                        Contraseña {editingUser ? "(Dejar vacío para mantener actual)" : "*"}
                      </label>
                      <input
                        required={!editingUser}
                        type="password"
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        className="flowbite-input"
                        placeholder="••••••••"
                      />
                    </div>

                    {/* Role */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Rol del Sistema *</label>
                      <LiquidSelect
                        value={userFormData.role}
                        onChange={(val) => setUserFormData({ ...userFormData, role: val })}
                        options={[
                          { value: "OPERATOR", label: "OPERATOR (Solo lectura/escritura básica)" },
                          { value: "ADMIN", label: "ADMIN (Permisos completos y administración)" },
                          { value: "AUDITOR", label: "AUDITOR (Solo auditoría y revisión)" },
                        ]}
                      />
                    </div>

                    {/* Theme */}
                    <div className="flowbite-form-group">
                      <label className="flowbite-form-label">Tema Visual</label>
                      <LiquidSelect
                        value={userFormData.theme}
                        onChange={(val) => setUserFormData({ ...userFormData, theme: val })}
                        options={[
                          { value: "SYSTEM", label: "Sistema (Predeterminado)" },
                          { value: "LIGHT", label: "Claro" },
                          { value: "DARK", label: "Oscuro" },
                        ]}
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
                    <button type="button" className="flowbite-btn flowbite-btn-text" onClick={() => setIsUserModalOpen(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="flowbite-btn flowbite-btn-primary">
                      {editingUser ? "Modificar" : "Crear"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal de Contraseña de Administrador */}
      {isAdminPromptOpen && (
        <Portal>
          <div
            className="flowbite-drawer-overlay animate-fade-in"
            style={{ justifyContent: "center", alignItems: "center", zIndex: 110 }}
            onClick={() => {
              setIsAdminPromptOpen(false);
              setAdminPasswordInput("");
              setAdminPromptError(null);
              setCurrencyToDelete(null);
            }}
          >
            <GlassCard
              className="flowbite-dropdown-animate"
              style={{
                width: "90%",
                maxWidth: "400px",
                margin: "0 auto",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  🔒 Autorización Requerida
                </span>
                <button
                  onClick={() => {
                    setIsAdminPromptOpen(false);
                    setAdminPasswordInput("");
                    setAdminPromptError(null);
                    setCurrencyToDelete(null);
                  }}
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

              <div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                  ¿Eliminar la moneda <strong>{currencyToDelete?.code} - {currencyToDelete?.name}</strong>?
                  <br /><br />
                  Solo es posible si no tiene operaciones ni cuentas asociadas. Para eliminarla de forma segura, se requieren permisos de administrador. Por favor, ingresa la contraseña:
                </p>
                <input
                  type="password"
                  className="flowbite-input"
                  placeholder="Contraseña de Administrador"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleVerifyAdminPasswordForDeletion();
                    }
                  }}
                  autoFocus
                />
                {adminPromptError && (
                  <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "6px", fontWeight: 500 }}>
                    ⚠️ {adminPromptError}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="flowbite-btn flowbite-btn-text"
                  onClick={() => {
                    setIsAdminPromptOpen(false);
                    setAdminPasswordInput("");
                    setAdminPromptError(null);
                    setCurrencyToDelete(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="flowbite-btn flowbite-btn-primary"
                  onClick={handleVerifyAdminPasswordForDeletion}
                >
                  Confirmar
                </button>
              </div>
            </GlassCard>
          </div>
        </Portal>
      )}
    </div>
  );
}
