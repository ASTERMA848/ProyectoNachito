"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

export default function Sidebar({ user, open, onClose }: { user?: { username: string; role: string; profilePicture?: string | null } | null; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const aside = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const query = matchMedia("(max-width: 1023px)");
    const update = () => { setMobile(query.matches); if (!query.matches) close.current(); };
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!aside.current) return;
    aside.current.inert = mobile && !open;
    if (!mobile || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aside.current.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const targets = aside.current?.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)");
      if (!targets?.length) return;
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [mobile, open]);

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
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
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
      ref={aside} id="app-sidebar" className={`app-sidebar ${open ? "is-open" : ""}`} role={mobile ? "dialog" : undefined}
      aria-label="Menú de navegación" aria-modal={mobile && open ? true : undefined} aria-hidden={mobile && !open ? true : undefined}
    >
      <div>
        <button type="button" className="app-sidebar-close" onClick={onClose} aria-label="Cerrar menú">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        {/* Brand Header */}
        <Link
          href="/"
          onClick={onClose}
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
        <nav aria-label="Secciones del sistema">
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
