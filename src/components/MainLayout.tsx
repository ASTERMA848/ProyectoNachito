"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import AuditorInspector from "./AuditorInspector";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isAuthPage = pathname === "/login" || pathname === "/logout";

  useEffect(() => {
    import("@/lib/liquid-glass/liquid-glass.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          
          const role = data.user.role;
          const username = data.user.username;
          const isAuditorRoute = pathname === "/audit" || pathname === "/sql-console";
          
          if (username === "admin") {
            // Admin total
          } else if (role === "AUDITOR") {
            if (!isAuditorRoute && pathname !== "/settings" && pathname !== "/logout") {
              router.push("/audit");
              return;
            }
          } else {
            if (isAuditorRoute) {
              router.push("/");
              return;
            }
          }
          
          setLoading(false);
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      }
    };

    checkAuth();
  }, [pathname, router, isAuthPage]);

  useEffect(() => {
    if (user?.theme) {
      if (user.theme === "DARK") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else if (user.theme === "LIGHT") {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      }
    } else {
      document.documentElement.classList.add("dark");
    }
  }, [user?.theme]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--ots-bg-canvas)",
          color: "var(--ots-text-secondary)",
          fontSize: "14px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              border: "3px solid var(--ots-border)",
              borderTop: "3px solid var(--ots-primary)",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              animation: "spin 1s linear infinite",
              margin: "0 auto 12px auto",
            }}
          />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ fontWeight: 500 }}>Cargando consola financiera...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar Lateral Fijo (Opción B: Neo-Fintech Minimal) */}
      <header className="app-mobile-header">
        <button id="app-menu-toggle" type="button" className="app-menu-toggle" aria-label="Abrir menú de navegación" aria-expanded={menuOpen} aria-controls="app-sidebar" onClick={() => setMenuOpen(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span>AGENCIA</span>
        <span className="app-mobile-user">{user?.username}</span>
      </header>
      {menuOpen && <button type="button" className="app-sidebar-backdrop" aria-label="Cerrar menú de navegación" tabIndex={-1} onClick={() => setMenuOpen(false)} />}
      <Sidebar user={user} open={menuOpen} onClose={() => setMenuOpen(false)} />
      
      {/* Contenido Principal desplazado 260px */}
      <main className="app-main">
        {children}
      </main>

      {/* Inspector Global para Auditor */}
      <AuditorInspector user={user} />
    </div>
  );
}
