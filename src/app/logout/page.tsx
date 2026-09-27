"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (e) {
        console.error("Logout request failed:", e);
      } finally {
        router.push("/login");
        router.refresh();
      }
    };
    performLogout();
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-color)",
        color: "var(--text-secondary)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "16px", fontWeight: 600 }}>Cerrando sesión...</p>
      </div>
    </div>
  );
}
