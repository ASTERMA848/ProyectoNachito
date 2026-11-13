"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Inbox, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  FormGroup,
  FormGroups,
  FormHeader,
  ReadonlyField,
  Select,
  Sheet,
  SheetTitle,
  SmartButton,
  SmartButtons,
  Spinner,
  TextInput,
  iconSize,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useLeaveGuard } from "@/components/shell/LeaveGuard";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { FormPage, Notice } from "@/components/shell/FormPage";
import { RecordHistory } from "@/components/shell/RecordHistory";
import { fetchList } from "@/components/shell/list-state";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { dayKey, dayLabel, formatTime } from "@/lib/agency-time";
import styles from "../settings.module.css";

type UserDetail = {
  user: { id: string; username: string; role: string; isActive: boolean; profilePicture: string | null; createdAt: string };
  counts: { auditLogs: number };
  lastLogin: string | null;
};

const ROLE_HELP: Record<string, string> = {
  ADMIN: "Hace todo: carga, reabre y elimina operaciones, y administra usuarios, monedas y ajustes.",
  OPERATOR: "Carga y edita operaciones, contactos, cuentas y tesorería. No reabre operaciones completadas.",
  AUDITOR: "Consulta todo, la auditoría y la consola SQL. No modifica datos.",
};

const USERNAME = /^[a-zA-Z0-9_.-]{3,64}$/;
const when = (value: string) => `${dayLabel(dayKey(value))} ${formatTime(value)}`;

// Alta y edición de un usuario: nombre, rol, contraseña y estado.
export default function UserForm({ id }: { id?: string }) {
  const router = useRouter();
  const me = useShellUser();
  const { notify, confirm } = useUiFeedback();
  const detail = useSWR<UserDetail>(id ? `/api/users/${id}` : null, fetchList);
  const user = detail.data?.user;

  const initial = useMemo(() => ({ username: user?.username ?? "", role: user?.role ?? "OPERATOR" }), [user]);
  const [values, setValues] = useState(initial);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setValues(initial);
  }
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || password !== "";
  useLeaveGuard(dirty);

  if (detail.error) {
    return (
      <EmptyState icon={<Inbox size={iconSize.lg} />} title="No se pudo abrir el usuario" action={<Button onClick={() => router.push("/settings/users")}>Volver a Usuarios</Button>}>
        {detail.error.message}
      </EmptyState>
    );
  }
  if (id && !detail.data) {
    return (
      <div aria-busy="true">
        <EmptyState icon={<Spinner label="Cargando el usuario" size="lg" />} title="Cargando el usuario" />
      </div>
    );
  }

  const editable = can(me, "settings.write");
  const self = id === me.id;
  const errors = {
    username: USERNAME.test(values.username.trim()) ? undefined : "Entre 3 y 64 letras, números, punto, guion o guion bajo",
    password: !id && !password ? "Escribí una contraseña inicial" : password && (password.length < 8 || password.length > 128) ? "Entre 8 y 128 caracteres" : undefined,
  };

  const save = async () => {
    if (errors.username || errors.password) {
      setShowErrors(true);
      return notify("Revisá los datos del usuario", "warning");
    }
    setBusy(true);
    const body = id ? { username: values.username, password, ...(self ? {} : { role: values.role }) } : { username: values.username, password, role: values.role };
    const response = await fetch(id ? `/api/users/${id}` : "/api/users", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return notify("No se pudo guardar", "danger", data?.error || "Probá de nuevo en un momento.");
    setPassword("");
    setShowErrors(false);
    notify(id ? "Usuario guardado" : "Usuario creado", "success");
    if (!id) return router.replace(`/settings/users/${data.user.id}`);
    await detail.mutate();
  };

  const setActive = async (isActive: boolean) => {
    if (!id || !user) return;
    if (!isActive) {
      const accepted = await confirm(`${user.username} no va a poder entrar y se cierran sus sesiones abiertas. Su historial se conserva.`, { title: "Pausar usuario", confirmLabel: "Pausar" });
      if (!accepted) return;
    }
    const response = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return notify("No se pudo actualizar el usuario", "danger", data?.error);
    notify(isActive ? "Usuario reactivado" : "Usuario pausado", "success");
    await detail.mutate();
  };

  const header = (
    <FormHeader
      actions={
        editable ? (
          <>
            {(dirty || !id) && <Button variant="primary" loading={busy} onClick={save}>Guardar</Button>}
            {dirty && id && (
              <Button
                onClick={() => {
                  setValues(initial);
                  setPassword("");
                }}
              >
                Descartar
              </Button>
            )}
            {!dirty && user && !self && user.isActive && <Button icon={<PauseCircle size={iconSize.sm} />} onClick={() => setActive(false)}>Pausar</Button>}
            {!dirty && user && !user.isActive && <Button icon={<PlayCircle size={iconSize.sm} />} onClick={() => setActive(true)}>Reactivar</Button>}
          </>
        ) : null
      }
    />
  );

  const name = user?.username ?? (values.username.trim() || "Nuevo usuario");

  return (
    <FormPage
      breadcrumbs={[{ label: "Configuración", href: "/settings" }, { label: "Usuarios", href: "/settings/users" }, { label: user?.username ?? "Nuevo" }]}
      dirty={dirty && Boolean(id)}
      header={header}
      aside={id ? <RecordHistory entity="User" id={id} refreshKey={detail.data} /> : undefined}
      notice={
        !editable ? (
          <Notice>Tu rol puede consultar los usuarios pero no modificarlos.</Notice>
        ) : user && !user.isActive ? (
          <Notice tone="warning" action={<Button size="sm" onClick={() => setActive(true)}>Reactivar</Button>}>Este usuario está pausado: no puede iniciar sesión.</Notice>
        ) : null
      }
    >
      <Sheet>
        <SheetTitle
          eyebrow={user ? user.isActive ? <Badge tone="success">Activo</Badge> : <Badge>Pausado</Badge> : undefined}
          aside={
            id && can(me, "audit.read") ? (
              <SmartButtons>
                <SmartButton icon={<ShieldCheck size={iconSize.md} />} value={detail.data?.counts.auditLogs ?? 0} label="Registros de auditoría" href={`/audit?filter=user:${id}`} />
              </SmartButtons>
            ) : undefined
          }
        >
          <span className={styles.titleWithAvatar}>
            <Avatar name={name} src={user?.profilePicture} size="lg" />
            {name}
          </span>
        </SheetTitle>
        <FormGroups>
          <FormGroup title="Acceso">
            <Field label="Usuario" layout="inline" required error={showErrors ? errors.username : undefined}>
              <TextInput value={values.username} autoComplete="off" disabled={!editable} maxLength={64} onChange={(event) => setValues((current) => ({ ...current, username: event.target.value }))} />
            </Field>
            <Field
              label={id ? "Nueva contraseña" : "Contraseña inicial"}
              layout="inline"
              required={!id}
              help={id ? "Vacía para no cambiarla. Si la cambiás, se cierran sus sesiones." : "Mínimo 8 caracteres. Pasásela al usuario por un canal seguro."}
              error={showErrors ? errors.password : undefined}
            >
              <TextInput type="password" autoComplete="new-password" value={password} disabled={!editable} onChange={(event) => setPassword(event.target.value)} />
            </Field>
          </FormGroup>
          <FormGroup title="Permisos">
            <Field label="Rol" layout="inline" help={self ? "No podés cambiar tu propio rol." : ROLE_HELP[values.role]}>
              <Select value={values.role} disabled={!editable || self} onChange={(event) => setValues((current) => ({ ...current, role: event.target.value }))}>
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </Select>
            </Field>
            {user && <ReadonlyField label="Alta">{when(user.createdAt)}</ReadonlyField>}
            {user && <ReadonlyField label="Último ingreso">{detail.data?.lastLogin ? when(detail.data.lastLogin) : "Nunca"}</ReadonlyField>}
          </FormGroup>
        </FormGroups>
      </Sheet>
    </FormPage>
  );
}
