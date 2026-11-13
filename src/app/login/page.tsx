"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeftRight, Eye, EyeOff } from "lucide-react";
import { Button, Field, IconButton, TextInput, iconSize } from "@/components/ui";
import styles from "./login.module.css";

// Solo se vuelve a rutas internas: nada de "//otro-sitio" ni direcciones completas.
function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || value.startsWith("/logout")) return "/";
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!username.trim() || !password) return setError("Escribí tu usuario y tu contraseña.");
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (response?.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    setLoading(false);
    setPassword("");
    setError(!response ? "No hay conexión con el servidor. Probá de nuevo." : data?.error || "No se pudo iniciar sesión.");
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-describedby={error ? "login-error" : undefined}>
      {error && (
        <div id="login-error" className={styles.error} role="alert">
          <AlertCircle size={iconSize.sm} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      <Field label="Usuario">
        <TextInput
          name="username"
          value={username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          disabled={loading}
          onChange={(event) => setUsername(event.target.value)}
        />
      </Field>
      <div className={styles.password}>
        <Field label="Contraseña">
          <TextInput
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            autoComplete="current-password"
            disabled={loading}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <IconButton
          label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={showPassword}
          size="sm"
          icon={showPassword ? <EyeOff size={iconSize.sm} /> : <Eye size={iconSize.sm} />}
          disabled={loading}
          onClick={() => setShowPassword((shown) => !shown)}
        />
      </div>
      <Button type="submit" variant="primary" loading={loading}>
        Ingresar
      </Button>
    </form>
  );
}

// Inicio de sesión en una tarjeta centrada, con la marca arriba.
export default function LoginPage() {
  return (
    <main className={`ui-app ${styles.page}`}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">
            <ArrowLeftRight size={iconSize.md} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Calce</span>
            <span className={styles.brandCaption}>Agencia de cambio</span>
          </span>
        </div>
        <section className={styles.card} aria-labelledby="login-title">
          <h1 id="login-title" className={styles.title}>Iniciar sesión</h1>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </section>
        <p className={styles.footer}>Si no podés entrar, pedile a un administrador que revise tu usuario.</p>
      </div>
    </main>
  );
}
