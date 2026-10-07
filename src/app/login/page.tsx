"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

function LoginIcon({ name }: { name: "building" | "user" | "lock" | "eye" | "eyeOff" | "arrow" | "alert" }) {
  const paths = {
    building: <><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M9 7h.01M15 7h.01M9 11h.01M15 11h.01M10 21v-6h4v6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 4M6.5 6.5A19 19 0 0 0 2 12s3.5 7 10 7a13 13 0 0 0 5.5-1.5M10 10a3 3 0 0 0 4 4" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
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
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Error al iniciar sesión");
        setLoading(false);
      }
    } catch {
      setError("Error de red. Intente nuevamente.");
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}><LoginIcon name="building" /></span>
          <div><span className={styles.brandName}>Agencia de Cambio</span><span className={styles.brandCaption}>Terminal de operaciones</span></div>
        </div>
        <section className={styles.card} aria-labelledby="login-title">
          <header className={styles.header}>
            <h1 id="login-title">Iniciar sesión</h1>
            <p>Inicie sesión para acceder a la terminal de operaciones.</p>
          </header>
          {error && <div id="login-error" className={styles.error} role="alert"><LoginIcon name="alert" /><span>{error}</span></div>}
          <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
            <div className={styles.field}>
              <label htmlFor="username">Usuario</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><LoginIcon name="user" /></span>
                <input id="username" name="username" required type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nombre de usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={loading} aria-describedby={error ? "login-error" : undefined} />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Contraseña</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><LoginIcon name="lock" /></span>
                <input id="password" name="password" required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingrese su contraseña" autoComplete="current-password" disabled={loading} aria-describedby={error ? "login-error" : undefined} className={styles.passwordInput} />
                <button type="button" className={styles.visibility} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} aria-controls="password" onClick={() => setShowPassword((shown) => !shown)} disabled={loading} title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><LoginIcon name={showPassword ? "eyeOff" : "eye"} /></button>
              </div>
            </div>
            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? <><span className={styles.spinner} aria-hidden="true" />Iniciando sesión...</> : <>Ingresar<LoginIcon name="arrow" /></>}
            </button>
          </form>
          <div className={styles.cardFooter}><LoginIcon name="lock" /><span>Control de acceso</span></div>
        </section>
        <p className={styles.footer}>Operaciones · Cuentas corrientes · Tesorería</p>
      </div>
    </main>
  );
}
