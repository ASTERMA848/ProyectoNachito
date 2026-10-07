"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export default function Sidebar({ user }: { user?: { username: string; role: string; profilePicture?: string | null } | null }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Dashboard", category: "gestion", icon: <HomeIcon size={20} /> },
    { href: "/operations", label: "Operaciones", category: "gestion", icon: <ArrowRightIcon size={20} /> },
    { href: "/treasury", label: "Tesorería", category: "gestion", icon: <BriefcaseIcon size={20} /> },
    { href: "/contacts", label: "Contactos", category: "gestion", icon: <UserIcon size={20} /> },
    { href: "/accounts", label: "Cuentas Ctes.", category: "gestion", icon: <BriefcaseIcon size={20} /> },
    { href: "/settings", label: "Configuración", category: "admin", icon: <SettingsIcon size={20} /> },
    { href: "/audit", label: "Auditoría", category: "admin", icon: <EyeIcon size={20} /> },
    { href: "/sql-console", label: "Consola SQL", category: "admin", icon: <CommandIcon size={20} /> },
    { href: "/manual", label: "Manual de Uso", category: "manual", icon: <InfoIcon size={20} /> },
  ];

  const allowedNavItems = navItems.filter((item) => {
    if (user?.username === "admin") return true;
    if (user?.role === "AUDITOR") {
      return ["/settings", "/audit", "/sql-console"].includes(item.href);
    }
    return !["/audit", "/sql-console"].includes(item.href);
  });

  const gestionItems = allowedNavItems.filter((i) => i.category === "gestion");
  const adminItems = allowedNavItems.filter((i) => i.category === "admin");
  const manualItems = allowedNavItems.filter((i) => i.category === "manual");

  const renderNavGroup = (title: string, items: typeof allowedNavItems) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--ots-text-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0 12px",
            marginBottom: "8px",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {items.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              >
                <span className="sidebar-icon" style={{ display: "inline-flex", color: isActive ? "var(--ots-primary)" : "var(--ots-text-muted)" }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside
      style={{
        width: "260px",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        backgroundColor: "var(--ots-surface-1)",
        borderRight: "1px solid var(--ots-border)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px 16px",
        zIndex: 100,
        boxShadow: "2px 0 12px rgba(0, 0, 0, 0.03)",
      }}
    >
      <div>
        {/* Brand Header */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
            color: "var(--ots-text-primary)",
            fontWeight: 700,
            fontSize: "20px",
            padding: "0 8px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "var(--ots-primary-muted)",
              border: "1px solid rgba(79, 70, 229, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              style={{ width: "20px", height: "20px", color: "var(--ots-primary)" }}
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
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ lineHeight: 1.2 }}>AGENCIA</span>
            <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--ots-text-muted)" }}>Fintech Console</span>
          </div>
        </Link>

        {/* Navigation Sections */}
        <nav>
          {renderNavGroup("Gestión Principal", gestionItems)}
          {renderNavGroup("Administración", adminItems)}
          {renderNavGroup("Ayuda", manualItems)}
        </nav>
      </div>

      {/* User Footer Card */}
      {user && (
        <div
          style={{
            backgroundColor: "var(--ots-surface-2)",
            border: "1px solid var(--ots-border)",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "999px",
                backgroundColor: "var(--ots-primary)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ots-text-primary)" }}>{user.username}</span>
              <span style={{ fontSize: "11px", color: "var(--ots-text-muted)" }}>{user.role}</span>
            </div>
          </div>
          <Link
            href="/logout"
            style={{
              color: "var(--ots-danger)",
              fontSize: "12px",
              textDecoration: "none",
              padding: "4px 8px",
              borderRadius: "6px",
              backgroundColor: "var(--ots-danger-bg)",
            }}
            title="Cerrar Sesión"
          >
            Salir
          </Link>
        </div>
      )}
    </aside>
  );
}

