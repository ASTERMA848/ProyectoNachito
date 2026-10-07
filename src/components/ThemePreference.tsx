"use client";

import { useRef, useState } from "react";
import { applyTheme, resolveTheme, THEME_CHANGED_EVENT, type UserTheme } from "@/lib/theme";
import styles from "./ThemePreference.module.css";

export default function ThemePreference({ value, userId, onChange, onSavingChange, disabled }: { value: string; userId: string; onChange: (theme: UserTheme) => void; onSavingChange: (saving: boolean) => void; disabled?: boolean }) {
  const [pending, setPending] = useState<UserTheme | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const saving = useRef(false);
  const selected = pending ?? resolveTheme(value);

  async function changeTheme(theme: UserTheme) {
    if (saving.current || theme === resolveTheme(value)) return;
    saving.current = true;
    onSavingChange(true);
    setPending(theme);
    setMessage("Guardando preferencia...");
    setError(false);
    applyTheme(theme);
    try {
      const response = await fetch("/api/auth/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el tema.");
      onChange(theme);
      window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { userId, theme } }));
      setMessage("Preferencia guardada para tus próximos ingresos.");
    } catch (failure) {
      applyTheme(value);
      setError(true);
      setMessage(failure instanceof Error ? failure.message : "Error de conexión. Volvé a intentarlo.");
    } finally {
      saving.current = false;
      onSavingChange(false);
      setPending(null);
    }
  }

  return <fieldset className={styles.fieldset} disabled={disabled || pending !== null}>
    <legend>Tema visual</legend>
    <p className={styles.description}>Elegí cómo querés ver la consola. Se guarda automáticamente para tu usuario.</p>
    <div className={styles.options}>
      {(["LIGHT", "DARK"] as const).map(theme => <label key={theme} className={styles.option}>
        <input type="radio" name="user-theme" value={theme} checked={selected === theme} onChange={() => changeTheme(theme)} />
        <span className={styles.choice}>
          <span className={`${styles.preview} ${theme === "DARK" ? styles.dark : styles.light}`} aria-hidden="true"><span className={styles.sidebar} /><span className={styles.workspace}><span className={styles.line} /><span className={styles.surface}><i /><i /><i /></span></span></span>
          <span className={styles.caption}><strong>{theme === "DARK" ? "Oscuro" : "Claro"}</strong><span className={styles.check} aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 4 4L19 6" /></svg></span></span>
          <span className={styles.detail}>{theme === "DARK" ? "Gris grafito y contraste suave" : "Fondos claros y acentos índigo"}</span>
        </span>
      </label>)}
    </div>
    <p className={`${styles.status} ${error ? styles.error : ""}`} role={error ? "alert" : "status"}>{message || "Podés cambiarlo cuando quieras."}</p>
  </fieldset>;
}
