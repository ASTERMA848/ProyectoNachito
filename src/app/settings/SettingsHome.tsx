"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, Coins, Pencil, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import {
  Avatar,
  Breadcrumbs,
  Button,
  ControlPanel,
  DateInput,
  Field,
  IconButton,
  Select,
  Setting,
  SettingsSection,
  Tag,
  TAG_COLORS,
  TextInput,
  iconSize,
  tagColorFromHex,
  type TagColor,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useLeaveGuard } from "@/components/shell/LeaveGuard";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { fetchList } from "@/components/shell/list-state";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { TAG_COLOR_LABELS, TAG_COLOR_VALUES } from "@/lib/tag-colors";
import styles from "./settings.module.css";

type Currency = { id: string; code: string; name: string; isActive: boolean };
type SettingsRow = { mainCurrencyId: string | null; accountingBlockDate: string | null };
type TagRow = { id: string; name: string; color: string | null };

export async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  return { ok: Boolean(response?.ok), data, error: (data?.error as string | undefined) ?? "Probá de nuevo en un momento." };
}

// Moneda principal y cierre contable: solo los cambia un administrador.
function GeneralSection({ currencies }: { currencies: Currency[] }) {
  const user = useShellUser();
  const { notify } = useUiFeedback();
  const { data, mutate } = useSWR<{ settings: SettingsRow }>("/api/settings", fetchList);
  const initial = useMemo(
    () => ({ mainCurrencyId: data?.settings.mainCurrencyId ?? "", accountingBlockDate: data?.settings.accountingBlockDate?.slice(0, 10) ?? "" }),
    [data],
  );
  const [values, setValues] = useState(initial);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setValues(initial);
  }
  const [busy, setBusy] = useState(false);
  const editable = can(user, "settings.write");
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useLeaveGuard(dirty);

  const save = async () => {
    setBusy(true);
    const result = await send("/api/settings", "PUT", values);
    setBusy(false);
    if (!result.ok) return notify("No se pudo guardar la configuración", "danger", result.error);
    notify("Configuración guardada", "success");
    await mutate();
  };

  return (
    <SettingsSection title="General">
      <Setting title="Moneda principal" htmlFor="main-currency" description="La que se usa como referencia en los totales de la agencia.">
        <Select id="main-currency" value={values.mainCurrencyId} disabled={!editable || !data} onChange={(event) => setValues((current) => ({ ...current, mainCurrencyId: event.target.value }))}>
          <option value="">Sin definir</option>
          {currencies.map((currency) => (
            <option key={currency.id} value={currency.id}>
              {currency.code} · {currency.name}
            </option>
          ))}
        </Select>
      </Setting>
      <Setting
        title="Cierre contable"
        htmlFor="block-date"
        description="No se pueden cargar ni modificar operaciones con fecha anterior a este día. Vacío: sin cierre."
      >
        <DateInput id="block-date" value={values.accountingBlockDate} disabled={!editable || !data} onChange={(event) => setValues((current) => ({ ...current, accountingBlockDate: event.target.value }))} />
      </Setting>
      {editable && dirty && (
        <div className={styles.sectionActions}>
          <Button variant="primary" loading={busy} onClick={save}>Guardar</Button>
          <Button onClick={() => setValues(initial)}>Descartar</Button>
        </div>
      )}
    </SettingsSection>
  );
}

function ColorPicker({ value, onChange, label }: { value: TagColor; onChange: (color: TagColor) => void; label: string }) {
  return (
    <div className={styles.colors} role="radiogroup" aria-label={label}>
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={TAG_COLOR_LABELS[color]}
          title={TAG_COLOR_LABELS[color]}
          className={styles.swatch}
          style={{ background: `var(--ui-tag-${color}-bg)`, borderColor: `var(--ui-tag-${color}-text)` }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

// Etiquetas de contactos: alta, cambio de nombre o color y baja.
function TagsSection() {
  const user = useShellUser();
  const { notify, confirm } = useUiFeedback();
  const { data, mutate } = useSWR<{ tags: TagRow[] }>("/api/tags", fetchList);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("blue");
  const [editing, setEditing] = useState<{ id: string; name: string; color: TagColor } | null>(null);
  const editable = can(user, "contacts.write");

  const create = async () => {
    if (!name.trim()) return notify("Escribí el nombre de la etiqueta", "warning");
    const result = await send("/api/tags", "POST", { name, color: TAG_COLOR_VALUES[color] });
    if (!result.ok) return notify("No se pudo crear la etiqueta", "danger", result.error);
    setName("");
    notify("Etiqueta creada", "success");
    await mutate();
  };

  const saveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    const result = await send(`/api/tags/${editing.id}`, "PUT", { name: editing.name, color: TAG_COLOR_VALUES[editing.color] });
    if (!result.ok) return notify("No se pudo guardar la etiqueta", "danger", result.error);
    setEditing(null);
    notify("Etiqueta guardada", "success");
    await mutate();
  };

  const remove = async (tag: TagRow) => {
    const accepted = await confirm(`Se quitará "${tag.name}" de todos los contactos que la tengan.`, { title: "Eliminar etiqueta", confirmLabel: "Eliminar", danger: true });
    if (!accepted) return;
    const result = await send(`/api/tags/${tag.id}`, "DELETE");
    if (!result.ok) return notify("No se pudo eliminar la etiqueta", "danger", result.error);
    notify("Etiqueta eliminada", "success");
    await mutate();
  };

  return (
    <SettingsSection title="Etiquetas de contactos">
      <div className={styles.wide}>
        {data && data.tags.length === 0 && <p className={styles.muted}>Todavía no hay etiquetas.</p>}
        <ul className={styles.tagList}>
          {data?.tags.map((tag) =>
            editing?.id === tag.id ? (
              <li key={tag.id} className={styles.tagEdit}>
                <Field label="Nombre">
                  <TextInput value={editing.name} maxLength={50} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                </Field>
                <ColorPicker label={`Color de ${tag.name}`} value={editing.color} onChange={(next) => setEditing({ ...editing, color: next })} />
                <span className={styles.rowActions}>
                  <Button size="sm" variant="primary" onClick={saveEdit}>Guardar</Button>
                  <Button size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
                </span>
              </li>
            ) : (
              <li key={tag.id} className={styles.tagRow}>
                <Tag color={tagColorFromHex(tag.color)}>{tag.name}</Tag>
                {editable && (
                  <span className={styles.rowActions}>
                    <IconButton label={`Editar ${tag.name}`} size="sm" icon={<Pencil size={iconSize.sm} />} onClick={() => setEditing({ id: tag.id, name: tag.name, color: tagColorFromHex(tag.color) })} />
                    <IconButton label={`Eliminar ${tag.name}`} size="sm" icon={<Trash2 size={iconSize.sm} />} onClick={() => void remove(tag)} />
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
        {editable && (
          <form
            className={styles.tagNew}
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <Field label="Nueva etiqueta">
              <TextInput value={name} maxLength={50} placeholder="Por ejemplo: Mayorista" onChange={(event) => setName(event.target.value)} />
            </Field>
            <ColorPicker label="Color de la nueva etiqueta" value={color} onChange={setColor} />
            <Button type="submit">Agregar</Button>
          </form>
        )}
      </div>
    </SettingsSection>
  );
}

// Configuración: ajustes generales, accesos a usuarios, monedas y el perfil, y etiquetas.
export default function SettingsHome() {
  const user = useShellUser();
  const { data: currencyData } = useSWR<{ currencies: Currency[] }>("/api/currencies", fetchList);
  const canSeeUsers = user.role === "ADMIN" || user.role === "AUDITOR";
  const { data: usersData } = useSWR<{ users: { isActive: boolean }[] }>(canSeeUsers ? "/api/users" : null, fetchList);
  const currencies = currencyData?.currencies ?? [];

  return (
    <div className={styles.page}>
      <ControlPanel start={<Breadcrumbs items={[{ label: "Configuración" }]} />} />
      <div className={styles.body}>
        <GeneralSection currencies={currencies} />

        <SettingsSection title="Administración">
          {canSeeUsers && (
            <Setting
              title="Usuarios"
              control={<Users size={iconSize.md} aria-hidden="true" />}
              description={usersData ? `${usersData.users.filter((row) => row.isActive).length} activos de ${usersData.users.length}` : "Accesos y roles de la agencia."}
            >
              <Link className={styles.link} href="/settings/users">
                Gestionar usuarios <ArrowRight size={iconSize.xs} aria-hidden="true" />
              </Link>
            </Setting>
          )}
          <Setting
            title="Monedas"
            control={<Coins size={iconSize.md} aria-hidden="true" />}
            description={currencyData ? `${currencies.filter((currency) => currency.isActive).length} activas de ${currencies.length}` : "Monedas con las que opera la agencia."}
          >
            <Link className={styles.link} href="/settings/currencies">
              Gestionar monedas <ArrowRight size={iconSize.xs} aria-hidden="true" />
            </Link>
          </Setting>
          <Setting title="Mi perfil" control={<UserRound size={iconSize.md} aria-hidden="true" />} description="Tu usuario, contraseña, tema y foto.">
            <Link className={styles.link} href="/settings/profile">
              Abrir mi perfil <ArrowRight size={iconSize.xs} aria-hidden="true" />
            </Link>
          </Setting>
          {can(user, "audit.read") && (
            <Setting title="Auditoría" control={<ShieldCheck size={iconSize.md} aria-hidden="true" />} description="Quién hizo cada cambio y cuándo.">
              <Link className={styles.link} href="/audit">
                Ver auditoría <ArrowRight size={iconSize.xs} aria-hidden="true" />
              </Link>
            </Setting>
          )}
        </SettingsSection>

        <TagsSection />
      </div>
    </div>
  );
}
