"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Header from "./Header";
import AuditorInspector from "./AuditorInspector";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const isAuthPage = pathname === "/login" || pathname === "/logout";

  // Registrar componentes web de LiquidGlass UI en el cliente siempre
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
          const isAuditorRoute = pathname === "/audit" || pathname === "/sql-console" || pathname === "/schema";
          
          if (username === "admin") {
            // El admin hardcodeado tiene acceso a todo
          } else if (role === "AUDITOR") {
            // AUDITOR solo puede ver auditoria, sql, schema y sus settings (y logout)
            if (!isAuditorRoute && pathname !== "/settings" && pathname !== "/logout") {
              router.push("/audit");
              return;
            }
          } else {
            // ADMIN y OPERATOR no pueden ver las rutas del auditor
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

  // Aplicar el tema del usuario
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
          backgroundColor: "var(--bg-color)",
          color: "var(--text-secondary)",
          fontFamily: "sans-serif",
          fontSize: "14px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              border: "3px solid var(--border-color)",
              borderTop: "3px solid var(--primary-color)",
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
          <p style={{ fontWeight: 500 }}>Validando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Header user={user} />
      <main className="main-content">
        <div className="content-area">
          {children}
        </div>
      </main>
      
      {/* Inspector Global para Auditor */}
      <AuditorInspector user={user} />
    </div>
  );
}
