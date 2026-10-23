"use client";

import { useState } from "react";
import { Button, Dialog, Field, TextInput } from "@/components/ui";

type AdminConfirmDialogProps = { open: boolean; title: string; description: string; confirmLabel: string; onClose: () => void; onConfirmed: () => void };

// Antes de tocar una operación completada, el administrador vuelve a escribir su contraseña.
export function AdminConfirmDialog({ open, title, description, confirmLabel, onClose, onConfirmed }: AdminConfirmDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const close = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  const verify = async () => {
    if (!password) return setError("Escribí tu contraseña.");
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return setError(data.error || "La contraseña no es correcta.");
      setPassword("");
      onConfirmed();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="primary" loading={checking} onClick={verify}>{confirmLabel}</Button>
          <Button onClick={close}>Cancelar</Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <p>{description}</p>
        <Field label="Tu contraseña de administrador" error={error ?? undefined}>
          <TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
