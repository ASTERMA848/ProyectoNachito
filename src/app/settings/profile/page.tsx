"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ShieldCheck } from "lucide-react";
import { Avatar, Breadcrumbs, Button, ControlPanel, Field, Select, SettingsSection, TextInput, iconSize } from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useLeaveGuard } from "@/components/shell/LeaveGuard";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { fetchList } from "@/components/shell/list-state";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { send } from "../SettingsHome";
import styles from "../settings.module.css";

type Me = { id: string; username: string; role: string; theme: string; profilePicture: string | null };

// Datos de la propia cuenta: usuario, contraseña, tema y foto.
function AccountSection() {
  const { notify } = useUiFeedback();
  const { data, mutate } = useSWR<{ user: Me }>("/api/auth/me", fetchList);
  const me = data?.user;
  const [username, setUsername] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentName = username ?? me?.username ?? "";
  const currentTheme = theme ?? me?.theme ?? "SYSTEM";
  const dirty = Boolean(me) && (currentName !== me?.username || currentTheme !== me?.theme || password !== "" || file !== null);
  useLeaveGuard(dirty);

  const save = async () => {
    if (!me) return;
    if (password && password.length < 8) return notify("La contraseña tiene que tener al menos 8 caracteres", "warning");
    if (password !== repeat) return notify("Las contraseñas no coinciden", "warning");
    setBusy(true);
    let picture = me.profilePicture;
    if (file) {
      const form = new FormData();
      form.append("file", file);
      const upload = await fetch("/api/upload", { method: "POST", body: form }).catch(() => null);
      const uploaded = await upload?.json().catch(() => ({}));
      if (!upload?.ok) {
        setBusy(false);
        return notify("No se pudo subir la foto", "danger", uploaded?.error || "Probá con otra imagen de hasta 5 MB.");
      }
      picture = uploaded.url;
    }
    const result = await send(`/api/users/${me.id}`, "PUT", { username: currentName, password, theme: currentTheme, profilePicture: picture });
    setBusy(false);
    if (!result.ok) return notify("No se pudo guardar tu cuenta", "danger", result.error);
    setPassword("");
    setRepeat("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    await mutate();
    notify("Cuenta actualizada", "success");
    // El nombre y el tema se leen al cargar la página.
    if (currentName !== me.username || currentTheme !== me.theme) window.location.reload();
  };

  return (
    <SettingsSection title="Mi cuenta">
      <div className={styles.wide}>
        {me && (
          <div className={styles.profileHead}>
            <Avatar name={me.username} src={me.profilePicture} size="lg" />
            <div>
              <p className={styles.strong}>{me.username}</p>
              <p className={styles.muted}>{ROLE_LABELS[me.role] ?? me.role}</p>
            </div>
          </div>
        )}
        <div className={styles.formGrid}>
          <Field label="Nombre de usuario" help="Letras, números, punto, guion y guion bajo.">
            <TextInput value={currentName} autoComplete="username" disabled={!me} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <Field label="Tema">
            <Select value={currentTheme} disabled={!me} onChange={(event) => setTheme(event.target.value)}>
              <option value="SYSTEM">Según el sistema</option>
              <option value="LIGHT">Claro</option>
              <option value="DARK">Oscuro</option>
            </Select>
          </Field>
          <Field label="Nueva contraseña" help="Dejala vacía para no cambiarla. Mínimo 8 caracteres.">
            <TextInput type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field label="Repetí la contraseña" error={repeat && password !== repeat ? "No coincide" : undefined}>
            <TextInput type="password" autoComplete="new-password" value={repeat} onChange={(event) => setRepeat(event.target.value)} />
          </Field>
          <Field label="Foto" help="JPG, PNG, GIF, WEBP o AVIF de hasta 5 MB.">
            <input ref={fileRef} className={styles.file} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </Field>
        </div>
        {dirty && (
          <div className={styles.sectionActions}>
            <Button variant="primary" loading={busy} onClick={save}>Guardar</Button>
            <Button
              onClick={() => {
                setUsername(null);
                setTheme(null);
                setPassword("");
                setRepeat("");
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Descartar
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

// Mi perfil: lo que cada usuario puede cambiar de su propia cuenta, sin depender de su rol.
export default function ProfilePage() {
  const user = useShellUser();
  return (
    <div className={styles.page}>
      <ControlPanel start={<Breadcrumbs items={[{ label: "Configuración", href: "/settings" }, { label: "Mi perfil" }]} />} />
      <div className={styles.body}>
        <AccountSection />
        {can(user, "audit.read") && (
          <p className={styles.muted}>
            <Link className={styles.link} href={`/audit?filter=user:${user.id}`}>
              <ShieldCheck size={iconSize.xs} aria-hidden="true" /> Ver mis cambios en la auditoría
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
