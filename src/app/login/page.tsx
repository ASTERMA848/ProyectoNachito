"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@liquefy-ui/react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirigir al dashboard tras login exitoso
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Error al iniciar sesión");
      }
    } catch (err) {
      setError("Error de red. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-color)",
        padding: "1rem",
      }}
    >
      <GlassCard
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 5vw, 2rem)",
          margin: 0,
        }}
      >
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <span className="section-eyebrow" style={{ marginBottom: "6px" }}>CONTROL DE ACCESO</span>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "var(--color-snow)",
              fontWeight: 600,
              fontSize: "20px",
              letterSpacing: "-0.5px",
              marginBottom: "6px",
              width: "100%",
            }}
          >
            {/* SVG Bank Icon */}
            <svg
              style={{ width: "22px", height: "22px", color: "var(--color-blue-cornflower)" }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>Agencia de Cambio</span>
          </div>
          <p style={{ color: "var(--color-ash)", fontSize: "13px" }}>
            Inicie sesión para acceder a la terminal de operaciones
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flowbite-alert flowbite-alert-warning" style={{ fontSize: "13px", padding: "10px 12px" }}>
            <span>️</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Username Input */}
            <div className="flowbite-form-group" style={{ margin: 0 }}>
              <label className="flowbite-form-label">Usuario</label>
              <input
                required
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flowbite-input"
                placeholder="Nombre de usuario"
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Password Input */}
            <div className="flowbite-form-group" style={{ margin: 0 }}>
              <label className="flowbite-form-label">Contraseña</label>
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flowbite-input"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {/* Show Password Checkbox */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                userSelect: "none",
                margin: "4px 0",
              }}
              onClick={() => setShowPassword(!showPassword)}
            >
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                  accentColor: "var(--primary-color)",
                }}
              />
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
                Mostrar contraseña
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="flowbite-btn flowbite-btn-primary"
              style={{ width: "100%", height: "42px", marginTop: "8px" }}
              disabled={loading}
            >
              {loading ? "Iniciando sesión..." : "Ingresar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
