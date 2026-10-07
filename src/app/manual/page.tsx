"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@liquefy-ui/react";

export default function ManualPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"auto" | "operator" | "admin">("auto");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (err) {
        console.error("Failed to load user info:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Determinar qué rol mostrar según el tab activo
  const displayedRole = 
    activeTab === "auto" 
      ? (currentUser?.role || "OPERATOR") 
      : activeTab === "operator" 
        ? "OPERATOR" 
        : "ADMIN";

  const isUserAdmin = currentUser?.role === "ADMIN";

  // Listado de secciones del manual
  const manualSections = [
    {
      id: "dashboard",
      title: "Resumen General (Dashboard)",
      category: "Gestión",
      isAdminOnly: false,
      summary: "Panel de control principal del sistema que ofrece una visión consolidada del estado financiero y operaciones del día.",
      features: [
        "Estadísticas de Operaciones: Conteo en tiempo real de operaciones Pendientes, En Proceso, Completadas y Canceladas.",
        "Saldos Cuentas Corrientes: Resumen acumulado de saldos de todas las divisas activas (USD, EUR, ARS, etc.).",
        "Liquidaciones a Vencer: Alertas visuales sobre los compromisos de pago con proveedores para los siguientes 7 días.",
        "Saldos por Contacto: Desglose del estado de cuenta de cada cliente y proveedor en particular, usando código de colores para indicar saldos a favor (verde) o deudas (rojo)."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      )
    },
    {
      id: "operations",
      title: "Operaciones de Cambio",
      category: "Gestión",
      isAdminOnly: false,
      summary: "Módulo central para registrar, seguir y completar transacciones de compra/venta de divisas extranjeras.",
      features: [
        "Crear Operaciones: Formulario para ingresar Cliente, Proveedor, Divisas (origen y destino), Montos y Tasa de cambio.",
        "Filtro Todo en Uno: Caja de búsqueda integrada al lado de un panel desplegable que permite filtrar simultáneamente por texto (nombre, nro. de operación), por estado, por rango de fechas (desde/hasta) y con opción rápida para filtrar solo las del día de 'Hoy'.",
        "Comentarios Internos: Espacio para añadir notas de seguimiento que quedan vinculadas a la operación de forma permanente.",
        "Carga de Adjuntos: Capacidad para subir comprobantes o facturas digitales asociados a la operación."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      id: "contacts",
      title: "Directorio de Contactos",
      category: "Gestión",
      isAdminOnly: false,
      summary: "Base de datos unificada de todos los clientes y proveedores asociados al negocio cambiario.",
      features: [
        "Clasificación Dual: Registro de personas o entidades marcando si actúan como Clientes, Proveedores o ambos.",
        "Etiquetas Personalizadas: Permite agrupar contactos con etiquetas (ej. VIP, Frecuente, Mayorista) creadas en el sistema.",
        "Datos de Identificación: Guardado de CUIT/CUIL, teléfono, email corporativo, dirección y observaciones generales.",
        "Filtros de Búsqueda: Buscador de texto y filtros por rol (Cliente/Proveedor) para una navegación rápida."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      id: "accounts",
      title: "Cuentas Corrientes",
      category: "Gestión",
      isAdminOnly: false,
      summary: "Historial de saldos y transacciones detalladas con clientes y proveedores por cada moneda en uso.",
      features: [
        "Saldos Consolidados: Visualización del saldo neto por cada divisa que el contacto posee en el sistema.",
        "Libro Mayor de Transacciones: Tabla cronológica que detalla el concepto, fecha, Débito (debe), Crédito (haber) y saldo acumulado.",
        "Impacto Contable: Las operaciones marcadas como 'COMPLETED' impactan automáticamente la cuenta corriente del cliente (debitando la moneda entregada) y del proveedor (acreditando la recibida)."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: "treasury",
      title: "Módulo de Tesorería",
      category: "Tesorería",
      isAdminOnly: false,
      summary: "Control absoluto de las cajas internas, cuentas bancarias y billeteras de la agencia.",
      features: [
        "Tipos de Cuenta: Clasificación de fondos entre Efectivo (Caja Fuerte), Bancos o Billeteras Digitales por moneda.",
        "Movimientos Manuales: Registro de ingresos directos, egresos de caja, transferencias entre cuentas propias y ajustes contables.",
        "Consulta de Saldos: Monitoreo en tiempo real del saldo disponible y auditoría cronológica de movimientos de cada cuenta."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: "settlements",
      title: "Liquidaciones a Proveedores",
      category: "Tesorería",
      isAdminOnly: false,
      summary: "Módulo para administrar los pagos y vencimientos pactados con proveedores en las operaciones cambiarias.",
      features: [
        "Fechas de Vencimiento: Registro de plazos de pago y alertas de liquidaciones vencidas o próximas a vencer.",
        "Pagos Parciales: Registro detallado de abonos en cuenta corriente, actualizando el saldo remanente a liquidar.",
        "Estados de Liquidación: Transición automática entre Pendiente, Parcialmente pagado, Liquidado y Expirado."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      id: "settings-profile",
      title: "Mi Perfil & Configuración de Etiquetas",
      category: "Configuración",
      isAdminOnly: false,
      summary: "Ajustes personales del usuario conectado y administración de la categorización de contactos.",
      features: [
        "Cambio de Credenciales: Permite actualizar el nombre de usuario y cambiar la contraseña personal de forma segura.",
        "Administrador de Etiquetas: Creación y edición de etiquetas para clientes/proveedores, asignando nombres y colores en formato hexadecimal."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: "currencies-admin",
      title: "Administración de Monedas",
      category: "Administración",
      isAdminOnly: true,
      summary: "Definición y control de los tipos de divisas aceptadas por el sistema cambiario.",
      features: [
        "Alta de Monedas: Agregar divisas especificando Código ISO (ej. USD), Símbolo ($), Decimales de redondeo y Color identificativo.",
        "Modificación y Estado: Editar los datos de las monedas o marcarlas como inactivas si ya no se comercializan."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: "users-admin",
      title: "Administración de Usuarios",
      category: "Administración",
      isAdminOnly: true,
      summary: "Control de acceso y creación de cuentas de operadores y administradores en la plataforma.",
      features: [
        "CRUD de Cuentas: Registrar nuevos usuarios, editar sus roles (ADMIN u OPERATOR) y restablecer contraseñas.",
        "Activar / Pausar: Detener temporalmente el acceso de un usuario de forma instantánea mediante el botón 'Pausar'.",
        "Trazabilidad por Usuario: Enlace directo al historial de auditoría de cada usuario para supervisar sus operaciones."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    },
    {
      id: "audit-logs",
      title: "Auditoría de Cambios",
      category: "Administración",
      isAdminOnly: true,
      summary: "Historial inmutable de auditoría para el cumplimiento de normativas de seguridad y transparencia.",
      features: [
        "Trazabilidad Completa: Registra quién realizó la acción, qué tipo de acción fue (Crear, Editar, Eliminar, Login, SQL), qué entidad fue afectada (Operación, Contacto, Configuración) y la marca de tiempo exacta.",
        "Visualizador de Diferencias: Muestra en formato JSON los valores anteriores frente a los valores nuevos cargados.",
        "Filtros de Auditoría: Búsqueda rápida de modificaciones filtrando por el identificador de un usuario específico."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      id: "sql-console",
      title: "Consola de Consultas SQL",
      category: "Administración",
      isAdminOnly: true,
      summary: "Interfaz de bajo nivel para que los administradores consulten la base de datos sqlite en tiempo real.",
      features: [
        "Consultas directas: Permite ejecutar sentencias SQL (ej. SELECT * FROM User;) y visualizar el resultado en formato de tabla.",
        "Seguridad de Solo Lectura: Bloqueo estricto del backend frente a sentencias destructivas o de modificación (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE).",
        "Registro de Auditoría: Cada consulta ejecutada por el administrador es grabada automáticamente en el log de auditoría."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: "completed-bypass",
      title: "Bypass Contable en Operaciones Completadas",
      category: "Especial",
      isAdminOnly: true,
      summary: "Mecanismo extraordinario para editar datos en operaciones que ya han sido cerradas contablemente.",
      features: [
        "Restricción Operador: Una vez que una operación pasa a estado 'COMPLETED', un operador no puede realizar ninguna modificación.",
        "Bypass con Clave Admin: Para realizar un cambio, el sistema requiere ingresar una contraseña de administrador válida directamente en el formulario de la operación para autorizar la petición al backend.",
        "Trazabilidad de Modificación: Estas modificaciones excepcionales son auditadas con alta prioridad, registrando los datos anteriores y nuevos del ajuste."
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    }
  ];

  // Filtrado final de secciones
  const filteredSections = manualSections.filter((sec) => {
    // Si buscamos algo en el manual
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchTitle = sec.title.toLowerCase().includes(term);
      const matchSummary = sec.summary.toLowerCase().includes(term);
      const matchFeature = sec.features.some(f => f.toLowerCase().includes(term));
      if (!matchTitle && !matchSummary && !matchFeature) return false;
    }
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ padding: "1.5rem 0" }}>
      {/* Header Banner Section */}
      <GlassCard
        style={{
          color: "var(--color-snow)",
          padding: "2rem",
          marginBottom: "2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <span className="section-eyebrow">DOCUMENTACIÓN & GUÍAS</span>
          <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px", letterSpacing: "-0.5px" }}>
            Manual de Uso del Sistema
          </h1>
          <p style={{ color: "var(--color-ash)", fontSize: "14px", maxWidth: "600px" }}>
            Guía integrada de operación y administración cambiaria. Consulta los permisos requeridos y aprende a utilizar cada uno de los módulos de la plataforma.
          </p>

          {/* User Role Status Display */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginTop: "1.5rem", color: "var(--ots-text-primary)" }}>
            <span style={{ fontSize: "13px", color: "var(--ots-text-secondary)" }}>Sesión:</span>
            {loading ? (
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Cargando...</span>
            ) : currentUser ? (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "13px" }}>{currentUser.username}</strong>
                <span 
                  className="flowbite-badge" 
                  style={{
                    backgroundColor: isUserAdmin ? "rgba(237, 235, 254, 0.2)" : "rgba(222, 247, 236, 0.2)",
                    color: isUserAdmin ? "#c084fc" : "#34d399",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px"
                  }}
                >
                  {currentUser.role === "ADMIN" ? "Administrador (ADMIN)" : "Operador (OPERATOR)"}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: "13px", color: "#f87171" }}>No Autenticado</span>
            )}
          </div>
        </div>

        {/* Decorative background shape */}
        <div 
          style={{
            position: "absolute",
            right: "-50px",
            bottom: "-50px",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.03)",
            pointerEvents: "none"
          }}
        />
      </GlassCard>

      {/* Control Panel: Filters & View Switcher */}
      <div 
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "2rem",
          backgroundColor: "var(--bg-card)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          
          {/* Tabs switch (Mode selector) */}
          <div style={{ display: "flex", gap: "4px", backgroundColor: "var(--bg-color)", padding: "4px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveTab("auto")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: activeTab === "auto" ? "var(--bg-card)" : "transparent",
                color: activeTab === "auto" ? "var(--primary-color)" : "var(--text-secondary)",
                boxShadow: activeTab === "auto" ? "var(--shadow-sm)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              Mi Rol {currentUser ? `(${currentUser.role})` : ""}
            </button>
            <button
              onClick={() => setActiveTab("operator")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: activeTab === "operator" ? "var(--bg-card)" : "transparent",
                color: activeTab === "operator" ? "var(--primary-color)" : "var(--text-secondary)",
                boxShadow: activeTab === "operator" ? "var(--shadow-sm)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              Vista Operador
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: activeTab === "admin" ? "var(--bg-card)" : "transparent",
                color: activeTab === "admin" ? "var(--primary-color)" : "var(--text-secondary)",
                boxShadow: activeTab === "admin" ? "var(--shadow-sm)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              Vista Administrador
            </button>
          </div>

          {/* Search tool inside manual */}
          <div className="flowbite-search-container" style={{ margin: 0, flex: "1 1 260px" }}>
            <svg
              aria-hidden="true"
              className="flowbite-search-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "16px", height: "16px" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flowbite-search-input"
              placeholder="Buscar funcionalidades..."
              style={{ paddingLeft: "36px", height: "38px" }}
            />
          </div>
        </div>

        {/* Notice of simulated state */}
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", borderTop: "1px solid var(--border-color)", paddingTop: "10px", marginTop: "4px" }}>
          <span>Mostrando manual con permisos de: </span>
          <span 
            className={`flowbite-badge ${displayedRole === "ADMIN" ? "flowbite-badge-purple" : "flowbite-badge-blue"}`}
            style={{ fontWeight: 700 }}
          >
            {displayedRole === "ADMIN" ? "ADMINISTRADOR (ADMIN)" : "OPERADOR (OPERATOR)"}
          </span>
          {activeTab !== "auto" && (
            <span style={{ marginLeft: "8px", fontStyle: "italic", color: "var(--text-light)" }}>
              (Vista previa simulada. Tu rol real es: {currentUser?.role || "cargando..."})
            </span>
          )}
        </div>
      </div>

      {/* Manual Content Grid */}
      {filteredSections.length === 0 ? (
        <GlassCard style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
          <p style={{ fontSize: "16px", fontWeight: 600 }}>No se encontraron funcionalidades coincidentes.</p>
          <button 
            onClick={() => setSearchTerm("")} 
            className="flowbite-btn flowbite-btn-secondary" 
            style={{ marginTop: "1rem" }}
          >
            Limpiar búsqueda
          </button>
        </GlassCard>
      ) : (
        <div 
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "1.5rem"
          }}
        >
          {filteredSections.map((sec) => {
            const hasAccess = !sec.isAdminOnly || displayedRole === "ADMIN";

            return (
              <GlassCard
                key={sec.id}
                style={{
                  margin: 0,
                  opacity: hasAccess ? 1 : 0.65,
                  transition: "all 0.2s ease-in-out",
                  borderLeft: `4px solid ${hasAccess ? (sec.isAdminOnly ? "var(--badge-purple-text)" : "var(--primary-color)") : "var(--border-color-medium)"}`,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  overflow: "hidden"
                }}
              >
                {/* Top Section */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                    
                    {/* Title and Icon */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span 
                        style={{
                          backgroundColor: hasAccess ? (sec.isAdminOnly ? "var(--badge-purple-bg)" : "var(--badge-blue-bg)") : "var(--badge-gray-bg)",
                          color: hasAccess ? (sec.isAdminOnly ? "var(--badge-purple-text)" : "var(--primary-color)") : "var(--text-light)",
                          width: "36px",
                          height: "36px",
                          borderRadius: "var(--radius-md)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        {sec.icon}
                      </span>
                      <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                        {sec.title}
                      </h3>
                    </div>

                    {/* Badge */}
                    <div>
                      {sec.isAdminOnly ? (
                        <span className="flowbite-badge flowbite-badge-purple" style={{ fontSize: "10px", whiteSpace: "nowrap" }}>
                          Solo Admin
                        </span>
                      ) : (
                        <span className="flowbite-badge flowbite-badge-blue" style={{ fontSize: "10px", whiteSpace: "nowrap" }}>
                          Acceso Libre
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px", lineHeight: 1.4 }}>
                    {sec.summary}
                  </p>

                  {/* Lock Overlay Notice if Restricted */}
                  {!hasAccess && (
                    <div 
                      style={{
                        backgroundColor: "var(--badge-red-bg)",
                        color: "var(--badge-red-text)",
                        border: "1px solid var(--badge-red-text)20",
                        borderRadius: "var(--radius-md)",
                        padding: "8px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "16px"
                      }}
                    >
                      <svg style={{ width: "16px", height: "16px", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Restringido: Requiere rol de Administrador.</span>
                    </div>
                  )}

                  {/* Bullet features list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <h4 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-light)", letterSpacing: "0.05em", margin: 0 }}>
                      Funcionalidades específicas:
                    </h4>
                    <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                      {sec.features.map((feat, idx) => {
                        const [boldText, normalText] = feat.split(":");
                        return (
                          <li 
                            key={idx} 
                            style={{ 
                              fontSize: "12.5px", 
                              color: hasAccess ? "var(--text-primary)" : "var(--text-secondary)",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "6px"
                            }}
                          >
                            <span style={{ color: hasAccess ? "var(--primary-color)" : "var(--text-light)", fontSize: "14px", lineHeight: "16px" }}>•</span>
                            <span style={{ lineHeight: 1.4 }}>
                              <strong style={{ fontWeight: 600 }}>{boldText}</strong>
                              {normalText ? `:${normalText}` : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* Card footer link preview if access is open */}
                {hasAccess && (
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                    {sec.id === "completed-bypass" ? (
                      <Link 
                        href="/operations"
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--primary-color)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span>Ir a Operaciones</span>
                        <span>→</span>
                      </Link>
                    ) : sec.id === "settings-profile" ? (
                      <Link 
                        href="/settings"
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--primary-color)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span>Ir a Configuración</span>
                        <span>→</span>
                      </Link>
                    ) : sec.id === "currencies-admin" || sec.id === "users-admin" ? (
                      <Link 
                        href="/settings"
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--primary-color)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span>Ir a Administración</span>
                        <span>→</span>
                      </Link>
                    ) : (
                      <Link 
                        href={`/${sec.id === "dashboard" ? "" : sec.id}`}
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--primary-color)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span>Ir al Módulo</span>
                        <span>→</span>
                      </Link>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Quick Procedures / Common Workflows Section */}
      <div 
        style={{
          marginTop: "3rem",
          backgroundColor: "var(--bg-card)",
          padding: "2rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <svg style={{ width: "22px", height: "22px", color: "var(--primary-color)" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Procedimientos Clave
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "1.5rem" }}>
          Guías paso a paso para resolver las operaciones cotidianas más importantes dentro de la plataforma.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "1.5rem" }}>
          
          {/* Procedure 1 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--primary-color)", letterSpacing: "0.05em" }}>OPERACIÓN ESTÁNDAR</span>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>¿Cómo registrar una nueva operación cambiaria?</h4>
            <ol style={{ fontSize: "13px", color: "var(--text-secondary)", paddingLeft: "1.2rem", lineHeight: 1.5 }}>
              <li>Navega al módulo de <strong>Operaciones</strong>.</li>
              <li>Presiona el botón de <strong>Registrar Operación</strong>.</li>
              <li>Selecciona el cliente y el proveedor involucrado (deben estar registrados en <strong>Contactos</strong>).</li>
              <li>Indica las divisas, montos y tasa acordada. El sistema calcula los montos equivalentes automáticamente.</li>
              <li>Escribe observaciones internas si lo consideras necesario.</li>
              <li>Haz clic en <strong>Guardar Operación</strong>. Se creará en estado <code>PENDING</code> (Pendiente).</li>
            </ol>
          </div>

          {/* Procedure 2 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--primary-color)", letterSpacing: "0.05em" }}>FLUJO DE ESTADOS</span>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>¿Cómo avanzar el estado contable de una operación?</h4>
            <ol style={{ fontSize: "13px", color: "var(--text-secondary)", paddingLeft: "1.2rem", lineHeight: 1.5 }}>
              <li>Haz clic sobre la operación deseada en la tabla para abrir el panel/drawer lateral de detalle.</li>
              <li>Utiliza el selector de <strong>Estado de Operación</strong>.</li>
              <li>Cámbialo a <code>PROCESSING</code> (En Proceso) al iniciar el movimiento físico de dinero.</li>
              <li>Pásalo a <code>COMPLETED</code> (Completado) una vez transferido. <em>Importante: En este punto se asientan automáticamente las cuentas corrientes de los contactos y no podrá ser editado por un operador.</em></li>
            </ol>
          </div>

          {/* Procedure 3 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "var(--badge-purple-text)", letterSpacing: "0.05em" }}>ADMINISTRACIÓN</span>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>¿Cómo editar una operación completada?</h4>
            <ol style={{ fontSize: "13px", color: "var(--text-secondary)", paddingLeft: "1.2rem", lineHeight: 1.5 }}>
              <li>Abre el panel de la operación completada y presiona <strong>Modificar Operación</strong>.</li>
              <li>Al realizar cambios en montos, fechas o contactos, aparecerá un campo adicional de <strong>Contraseña de Administrador</strong>.</li>
              <li>Solicita la clave a un Administrador o colócala si posees el rol <code>ADMIN</code>.</li>
              <li>Presiona guardar. El backend autenticará la clave y actualizará las cuentas corrientes re-calculando los saldos modificados.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
