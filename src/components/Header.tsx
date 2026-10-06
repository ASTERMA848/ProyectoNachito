"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GlassDock, DockItem, LiquidTooltip, LiquidMenu } from "@liquefy-ui/react";
import {
  HomeIcon,
  ArrowRightIcon,
  UserIcon,
  BriefcaseIcon,
  SettingsIcon,
  EyeIcon,
  CommandIcon,
  InfoIcon,
} from "@liquefy-ui/icons";

export default function Header({ user }: { user?: { username: string; role: string; profilePicture?: string | null } | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Definición de las categorías y sus enlaces (para mobile)
  const menuCategories = [
    {
      id: "gestion",
      label: "Gestión",
      routes: [
        { href: "/", label: "Dashboard" },
        { href: "/operations", label: "Operaciones" },
        { href: "/contacts", label: "Contactos" },
        { href: "/accounts", label: "Cuentas Ctes." },
      ],
    },
    {
      id: "admin",
      label: "Administración",
      routes: [
        { href: "/settings", label: "Configuración" },
        { href: "/audit", label: "Auditoría" },
        { href: "/sql-console", label: "Consola SQL" },
      ],
    },
  ];

  // Opciones completas con iconos para GlassDock (tamaño proporcionado y con presencia)
  const navItems = [
    { href: "/", label: "Dashboard", category: "gestion", icon: <HomeIcon size={26} /> },
    { href: "/operations", label: "Operaciones", category: "gestion", icon: <ArrowRightIcon size={26} /> },
    { href: "/contacts", label: "Contactos", category: "gestion", icon: <UserIcon size={26} /> },
    { href: "/accounts", label: "Cuentas Ctes.", category: "gestion", icon: <BriefcaseIcon size={26} /> },
    { href: "/settings", label: "Configuración", category: "admin", icon: <SettingsIcon size={26} /> },
    { href: "/audit", label: "Auditoría", category: "admin", icon: <EyeIcon size={26} /> },
    { href: "/sql-console", label: "Consola SQL", category: "admin", icon: <CommandIcon size={26} /> },
    { href: "/manual", label: "Manual de Uso", category: "manual", icon: <InfoIcon size={26} /> },
  ];

  // Filtrar según los permisos del usuario
  const allowedNavItems = navItems.filter((item) => {
    if (user?.username === "admin") return true;
    if (user?.role === "AUDITOR") {
      return ["/settings", "/audit", "/sql-console"].includes(item.href);
    }
    // ADMIN y OPERATOR
    return !["/audit", "/sql-console"].includes(item.href);
  });

  return (
    <header className="flowbite-header">
      {/* Left section: Workspace Logo */}
      <div className="flowbite-header-left">
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
            color: "var(--text-primary)",
            fontWeight: 600,
            fontSize: "20px",
            letterSpacing: "-0.025em",
          }}
        >
          {/* SVG Bank Icon */}
          <svg
            className="w-6 h-6"
            style={{ width: "22px", height: "22px", color: "var(--primary-color)" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span>Agencia</span>
        </Link>
      </div>

      {/* Center section: GlassDock (Liquefy UI) con LiquidTooltip en cada opción */}
      <div className="flowbite-desktop-nav">
        <GlassDock label="Navegación principal" position="inline">
          {allowedNavItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <LiquidTooltip
                key={item.href}
                content={item.label}
                placement="bottom"
                delay={60}
                {...({ active: isActive } as any)}
              >
                <DockItem
                  label={item.label}
                  icon={item.icon}
                  active={isActive}
                  title=""
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      window.open(item.href, "_blank");
                    } else {
                      router.push(item.href);
                    }
                  }}
                />
              </LiquidTooltip>
            );
          })}
        </GlassDock>
      </div>

      {/* Right section: User Profile + Hamburger (Mobile) */}
      <div className="flowbite-header-right">
        {user && (
          <div
            className="flowbite-nav-dropdown-container"
            onMouseEnter={() => setOpenDropdown("user-profile")}
            onMouseLeave={() => setOpenDropdown(null)}
            style={{ position: "relative" }}
          >
            {/* Trigger Button */}
            <button
              style={{
                background: "none",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "16.5px",
                fontWeight: 500,
                padding: "8px 12px",
                borderRadius: "var(--radius-lg)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: openDropdown === "user-profile" ? "var(--hover-bg)" : "transparent",
                transition: "all 0.15s ease",
              }}
            >
              {user.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.username}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid var(--border-color)",
                  }}
                />
              ) : (
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(103, 152, 255, 0.12)",
                    color: "var(--color-blue-cornflower)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    fontFamily: "var(--font-jetbrains-mono)",
                    border: "1px solid rgba(103, 152, 255, 0.3)",
                  }}
                >
                  {user.username.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="flowbite-desktop-username">{user.username}</span>
              <span style={{ fontSize: "12px", color: "var(--text-light)" }}>▼</span>
            </button>

            {/* Dropdown Menu */}
            {openDropdown === "user-profile" && (
              <div
                className="flowbite-nav-dropdown-menu flowbite-dropdown-animate"
                style={{
                  right: 0,
                  left: "auto",
                  minWidth: "160px",
                  position: "absolute",
                  top: "100%",
                }}
              >
                <div
                  style={{
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--border-color)",
                    fontSize: "15px",
                    color: "var(--text-secondary)",
                  }}
                >
                  Rol: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{user.role}</strong>
                </div>
                <Link
                  href="/logout"
                  onClick={() => setOpenDropdown(null)}
                  className="flowbite-nav-dropdown-item"
                  style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  Cerrar Sesión
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Hamburger Menu Button */}
        <button
          className="flowbite-mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {isMobileMenuOpen ? (
            <svg style={{ width: "22px", height: "22px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg style={{ width: "22px", height: "22px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div
          className="flowbite-mobile-menu-panel"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "var(--bg-color)",
            borderBottom: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-md)",
            zIndex: 80,
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxHeight: "calc(100vh - 60px)",
            overflowY: "auto",
          }}
        >
          {menuCategories.map((category) => {
            // Filtrar rutas del menú según el rol del usuario
            let allowedRoutes = category.routes;
            
            if (user?.username === "admin") {
              allowedRoutes = category.routes;
            } else if (user?.role === "AUDITOR") {
              if (category.id !== "admin") {
                allowedRoutes = [];
              } else {
                allowedRoutes = category.routes;
              }
            } else {
              if (category.id === "admin") {
                allowedRoutes = category.routes.filter((route) => route.href === "/settings");
              }
            }

            if (allowedRoutes.length === 0) return null;

            return (
              <div key={category.id} style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "var(--text-primary)",
                    letterSpacing: "0.08em",
                    padding: "8px 12px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderLeft: "3px solid var(--primary-color)",
                    borderRadius: "0 6px 6px 0",
                  }}
                >
                  {category.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {allowedRoutes.map((route) => {
                    const isItemActive = pathname === route.href;
                    return (
                      <Link
                        key={route.href}
                        href={route.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flowbite-nav-dropdown-item ${isItemActive ? "active" : ""}`}
                        style={{ padding: "10px 14px" }}
                      >
                        <span>{route.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {/* Manual de Uso Standalone Link (Mobile, oculto para AUDITOR, excepto admin hardcodeado) */}
          {(user?.username === "admin" || user?.role !== "AUDITOR") && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Link
                href="/manual"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flowbite-nav-dropdown-item ${pathname === "/manual" ? "active" : ""}`}
                style={{ padding: "10px 14px", fontWeight: 500 }}
              >
                <span>Manual de Uso</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
