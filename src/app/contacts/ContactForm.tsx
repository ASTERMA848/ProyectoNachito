"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeftRight, Archive, ArchiveRestore, Inbox, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  FormGroup,
  FormGroups,
  FormHeader,
  HistoryPanel,
  Sheet,
  SheetTitle,
  SmartButton,
  SmartButtons,
  Spinner,
  TabPanel,
  Tabs,
  Tag,
  TextArea,
  TextInput,
  iconSize,
  tagColorFromHex,
  type Column,
  type HistoryGroup,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useLeaveGuard } from "@/components/shell/LeaveGuard";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { FormPage, Notice } from "@/components/shell/FormPage";
import { RecordPager } from "@/components/shell/RecordPager";
import { fetchList } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import { formatAmount } from "@/lib/format-currency";
import type { ContactListItem } from "@/lib/resources/contacts";
import { fullName } from "./ContactsList";
import styles from "./contacts.module.css";

type Balance = { accountId: string; currency: { id: string; code: string; decimals: number }; balance: string };
type ContactDetail = { contact: ContactListItem; counts: { operations: number }; balances: Balance[] };
type TagRow = { id: string; name: string; color: string | null };

type Values = {
  name: string;
  lastname: string;
  document: string;
  cuitCuil: string;
  phone: string;
  email: string;
  address: string;
  observations: string;
  isClient: boolean;
  isProvider: boolean;
  tagIds: string[];
};

const EMPTY: Values = { name: "", lastname: "", document: "", cuitCuil: "", phone: "", email: "", address: "", observations: "", isClient: true, isProvider: false, tagIds: [] };

const valuesFrom = (contact?: ContactListItem): Values =>
  contact
    ? {
        name: contact.name,
        lastname: contact.lastname ?? "",
        document: contact.document ?? "",
        cuitCuil: contact.cuitCuil ?? "",
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        address: contact.address ?? "",
        observations: contact.observations ?? "",
        isClient: contact.isClient,
        isProvider: contact.isProvider,
        tagIds: contact.tags.map(({ tag }) => tag.id),
      }
    : EMPTY;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ficha de contacto: datos, etiquetas, saldos por moneda e historial de cambios.
export default function ContactForm({ id }: { id?: string }) {
  const router = useRouter();
  const user = useShellUser();
  const { notify, confirm } = useUiFeedback();

  const detail = useSWR<ContactDetail>(id ? `/api/contacts/${id}` : null, fetchList);
  const tags = useSWR<{ tags: TagRow[] }>("/api/tags", fetchList);
  const history = useSWR<{ groups: HistoryGroup[] }>(id ? `/api/history?entity=Contact&id=${id}` : null, fetchList);

  const contact = detail.data?.contact;
  const initial = useMemo(() => valuesFrom(contact), [contact]);
  const [values, setValues] = useState(initial);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setValues(initial);
  }
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("notes");
  const [showErrors, setShowErrors] = useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useLeaveGuard(dirty);

  if (detail.error) {
    return (
      <EmptyState icon={<Inbox size={iconSize.lg} />} title="No se pudo abrir el contacto" action={<Button onClick={() => router.push("/contacts")}>Volver a Contactos</Button>}>
        {detail.error.message}
      </EmptyState>
    );
  }
  if (id && !detail.data) {
    return (
      <div aria-busy="true">
        <EmptyState icon={<Spinner label="Cargando el contacto" size="lg" />} title="Cargando el contacto" />
      </div>
    );
  }

  const canWrite = can(user, "contacts.write");
  const archived = contact ? !contact.isActive : false;
  const editable = canWrite;
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  const errors = {
    name: values.name.trim() ? undefined : "Escribí el nombre",
    email: values.email.trim() && !EMAIL.test(values.email.trim()) ? "Revisá el formato del email" : undefined,
    roles: values.isClient || values.isProvider ? undefined : "Marcá si es cliente, proveedor o ambos",
  };
  const valid = !errors.name && !errors.email && !errors.roles;

  const save = async () => {
    if (!valid) {
      setShowErrors(true);
      return notify("Faltan datos para guardar el contacto", "warning");
    }
    // Aviso, no bloqueo: la agencia puede tener un motivo real para repetir un documento o un email.
    const changedIdentity = values.document !== initial.document || values.cuitCuil !== initial.cuitCuil || values.email !== initial.email;
    if (changedIdentity) {
      const params = new URLSearchParams();
      if (values.document.trim()) params.set("document", values.document.trim());
      if (values.cuitCuil.trim()) params.set("cuitCuil", values.cuitCuil.trim());
      if (values.email.trim()) params.set("email", values.email.trim());
      if (id) params.set("excludeId", id);
      if (params.toString()) {
        const matches = await fetchList<{ matches: { id: string; name: string; lastname: string | null }[] }>(`/api/contacts/check-duplicate?${params}`).catch(() => ({ matches: [] }));
        if (matches.matches.length) {
          const names = matches.matches.map((match) => [match.name, match.lastname].filter(Boolean).join(" ")).join(", ");
          const accepted = await confirm(`Ya hay un contacto activo con el mismo documento, CUIT/CUIL o email: ${names}. ¿Guardar igual?`, {
            title: "Contacto parecido a otro ya cargado",
            confirmLabel: "Guardar igual",
          });
          if (!accepted) return;
        }
      }
    }
    setBusy(true);
    const response = await fetch(id ? `/api/contacts/${id}` : "/api/contacts", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    setBusy(false);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return notify("No se pudo guardar", "danger", data?.error || "Probá de nuevo en un momento.");
    setShowErrors(false);
    notify(id ? "Cambios guardados" : "Contacto creado", "success");
    if (!id) return router.replace(`/contacts/${data.id}`);
    await Promise.all([detail.mutate(), history.mutate()]);
  };

  const setActive = async (isActive: boolean) => {
    if (!id) return;
    if (!isActive) {
      const accepted = await confirm("Deja de aparecer en las listas y al cargar operaciones. Sus operaciones y saldos se conservan.", {
        title: "Archivar contacto",
        confirmLabel: "Archivar",
      });
      if (!accepted) return;
    }
    const response = await fetch(`/api/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).catch(() => null);
    if (!response?.ok) return notify("No se pudo actualizar el contacto", "danger");
    notify(isActive ? "Contacto desarchivado" : "Contacto archivado", "success");
    await Promise.all([detail.mutate(), history.mutate()]);
  };

  const remove = async () => {
    if (!id || !contact) return;
    const accepted = await confirm(`Se eliminará ${fullName(contact)}. Sus operaciones quedan registradas con su nombre.`, {
      title: "Eliminar contacto",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!accepted) return;
    const response = await fetch(`/api/contacts/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) return notify("No se pudo eliminar", "danger");
    notify(`${fullName(contact)} eliminado`, "success");
    router.push("/contacts");
  };

  const toggleTag = (tagId: string) => set("tagIds", values.tagIds.includes(tagId) ? values.tagIds.filter((current) => current !== tagId) : [...values.tagIds, tagId]);

  const text = (key: "name" | "lastname" | "document" | "cuitCuil" | "phone" | "email" | "address", extra: { type?: string; inputMode?: "tel" | "email" | "numeric"; autoComplete?: string } = {}) => (
    <TextInput value={values[key]} disabled={!editable} onChange={(event) => set(key, event.target.value)} maxLength={key === "address" ? 500 : 200} {...extra} />
  );

  const balanceColumns: Column<Balance>[] = [
    { key: "currency", label: "Moneda", render: (row) => row.currency.code },
    { key: "balance", label: "Saldo", align: "end", render: (row) => formatAmount(row.balance, row.currency.code, row.currency.decimals) },
  ];

  const title = contact ? fullName(contact) : values.name.trim() ? [values.name, values.lastname].filter(Boolean).join(" ") : "Nuevo contacto";

  const header = (
    <FormHeader
      actions={
        editable ? (
          <>
            {(dirty || !id) && <Button variant="primary" loading={busy} onClick={save}>Guardar</Button>}
            {dirty && id && <Button onClick={() => setValues(initial)}>Descartar</Button>}
            {!dirty && id && !archived && <Button icon={<Archive size={iconSize.sm} />} onClick={() => setActive(false)}>Archivar</Button>}
            {!dirty && id && archived && <Button icon={<ArchiveRestore size={iconSize.sm} />} onClick={() => setActive(true)}>Desarchivar</Button>}
          </>
        ) : null
      }
    />
  );

  return (
    <FormPage
      breadcrumbs={[{ label: "Contactos", href: "/contacts" }, { label: contact ? fullName(contact) : "Nuevo" }]}
      pager={id ? <RecordPager resource="contacts" id={id} hrefOf={(next) => `/contacts/${next}`} label="Contactos de la lista" /> : undefined}
      dirty={dirty && Boolean(id)}
      actions={id && can(user, "operations.delete") ? <Button variant="ghost" size="sm" icon={<Trash2 size={iconSize.sm} />} onClick={remove}>Eliminar</Button> : null}
      header={header}
      notice={
        !canWrite ? (
          <Notice>Tu rol puede consultar los contactos pero no modificarlos.</Notice>
        ) : archived ? (
          <Notice tone="warning" action={<Button size="sm" onClick={() => setActive(true)}>Desarchivar</Button>}>
            Este contacto está archivado: no aparece al cargar operaciones.
          </Notice>
        ) : null
      }
      aside={id ? <HistoryPanel groups={history.data?.groups ?? []} emptyText="Todavía no hay cambios registrados." /> : undefined}
    >
      <Sheet>
        <SheetTitle
          eyebrow={
            <span className={styles.roles}>
              {values.isClient && <Badge tone="info">Cliente</Badge>}
              {values.isProvider && <Badge tone="info">Proveedor</Badge>}
            </span>
          }
          aside={
            id ? (
              <SmartButtons>
                <SmartButton icon={<ArrowLeftRight size={iconSize.md} />} value={detail.data?.counts.operations ?? 0} label="Operaciones" href={`/operations?filter=contact:${id}`} />
              </SmartButtons>
            ) : undefined
          }
        >
          {title}
        </SheetTitle>

        <FormGroups>
          <FormGroup title="Datos">
            <Field label="Nombre" layout="inline" required error={showErrors ? errors.name : undefined}>
              {text("name", { autoComplete: "off" })}
            </Field>
            <Field label="Apellido" layout="inline">{text("lastname", { autoComplete: "off" })}</Field>
            <Field label="DNI" layout="inline">{text("document", { inputMode: "numeric" })}</Field>
            <Field label="CUIT / CUIL" layout="inline">{text("cuitCuil", { inputMode: "numeric" })}</Field>
          </FormGroup>
          <FormGroup title="Contacto">
            <Field label="Teléfono" layout="inline">{text("phone", { type: "tel", inputMode: "tel" })}</Field>
            <Field label="Email" layout="inline" error={showErrors ? errors.email : undefined}>
              {text("email", { type: "email", inputMode: "email" })}
            </Field>
            <Field label="Dirección" layout="inline">{text("address")}</Field>
          </FormGroup>
        </FormGroups>

        <FormGroups>
          <FormGroup title="Rol">
            <Checkbox label="Es cliente" checked={values.isClient} disabled={!editable} onChange={(event) => set("isClient", event.target.checked)} />
            <Checkbox label="Es proveedor" checked={values.isProvider} disabled={!editable} onChange={(event) => set("isProvider", event.target.checked)} />
            {showErrors && errors.roles && <span className={styles.error} role="alert">{errors.roles}</span>}
          </FormGroup>
          <FormGroup title="Etiquetas">
            {tags.data?.tags.length ? (
              <div className={styles.tagEditor} role="group" aria-label="Etiquetas del contacto">
                {tags.data.tags.map((tag) => {
                  const on = values.tagIds.includes(tag.id);
                  return (
                    <button key={tag.id} type="button" className={styles.tagToggle} aria-pressed={on} disabled={!editable} onClick={() => toggleTag(tag.id)}>
                      <Tag color={on ? tagColorFromHex(tag.color) : undefined}>{tag.name}</Tag>
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className={styles.muted}>{tags.data ? "Todavía no hay etiquetas." : "Cargando etiquetas..."}</span>
            )}
          </FormGroup>
        </FormGroups>

        <Tabs
          idPrefix="contact"
          label="Más datos del contacto"
          value={tab}
          onChange={setTab}
          tabs={[{ id: "notes", label: "Observaciones" }, ...(id ? [{ id: "balances", label: "Saldos" }] : [])]}
        />
        <TabPanel idPrefix="contact" tabId="notes" active={tab === "notes"}>
          <Field label="Observaciones">
            <TextArea rows={3} value={values.observations} disabled={!editable} maxLength={2000} onChange={(event) => set("observations", event.target.value)} />
          </Field>
        </TabPanel>
        {id && (
          <TabPanel idPrefix="contact" tabId="balances" active={tab === "balances"}>
            <div className={styles.balances}>
              <DataTable
                caption="Saldos por moneda"
                columns={balanceColumns}
                rows={detail.data?.balances ?? []}
                rowKey={(row) => row.accountId}
                rowLabel={(row) => `Estado de cuenta en ${row.currency.code}`}
                onRowOpen={(row) => router.push(`/accounts/${row.accountId}`)}
                empty={<EmptyState title="Sin cuenta corriente">Se abre sola con la primera operación del contacto.</EmptyState>}
              />
            </div>
          </TabPanel>
        )}
      </Sheet>
    </FormPage>
  );
}
