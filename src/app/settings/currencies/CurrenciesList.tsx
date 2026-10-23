"use client";

import { useState } from "react";
import useSWR from "swr";
import { Inbox, Trash2 } from "lucide-react";
import { Breadcrumbs, Button, ControlPanel, DataTable, Dialog, EmptyState, Field, Switch, TextInput, iconSize, type Column } from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { AdminConfirmDialog } from "@/components/shell/AdminConfirmDialog";
import { fetchList } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import styles from "../settings.module.css";

type Currency = { id: string; code: string; name: string; symbol: string; decimals: number; isActive: boolean };
type Draft = { id?: string; code: string; name: string; symbol: string; decimals: string };

const EMPTY: Draft = { code: "", name: "", symbol: "", decimals: "2" };

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  return { ok: Boolean(response?.ok), error: (data?.error as string | undefined) ?? "Probá de nuevo en un momento." };
}

// Monedas de la agencia: alta, edición, activar o desactivar y baja de las que nunca se usaron.
export default function CurrenciesList() {
  const user = useShellUser();
  const { notify } = useUiFeedback();
  const { data, error, isLoading, mutate } = useSWR<{ currencies: Currency[] }>("/api/currencies", fetchList);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Currency | null>(null);
  const editable = can(user, "settings.write");

  const errors = draft && {
    code: /^[A-Za-z0-9]{1,10}$/.test(draft.code.trim()) ? undefined : "Hasta 10 letras o números, por ejemplo USD",
    name: draft.name.trim() ? undefined : "Escribí el nombre",
    symbol: draft.symbol.trim() ? undefined : "Escribí el símbolo",
    decimals: /^[0-8]$/.test(draft.decimals.trim()) ? undefined : "Entre 0 y 8",
  };

  const close = () => {
    setDraft(null);
    setShowErrors(false);
  };

  const save = async () => {
    if (!draft || !errors) return;
    if (Object.values(errors).some(Boolean)) return setShowErrors(true);
    setBusy(true);
    const body = { code: draft.code.trim().toUpperCase(), name: draft.name, symbol: draft.symbol, decimals: Number(draft.decimals) };
    const result = await send(draft.id ? `/api/currencies/${draft.id}` : "/api/currencies", draft.id ? "PUT" : "POST", body);
    setBusy(false);
    if (!result.ok) return notify("No se pudo guardar la moneda", "danger", result.error);
    notify(draft.id ? "Moneda guardada" : "Moneda creada, con su caja en Tesorería", "success");
    close();
    await mutate();
  };

  const toggle = async (currency: Currency) => {
    const result = await send(`/api/currencies/${currency.id}`, "PUT", { isActive: !currency.isActive });
    if (!result.ok) return notify("No se pudo cambiar la moneda", "danger", result.error);
    notify(currency.isActive ? `${currency.code} desactivada: no se ofrece al cargar operaciones` : `${currency.code} activada`, "success");
    await mutate();
  };

  const remove = async (currency: Currency) => {
    const result = await send(`/api/currencies/${currency.id}`, "DELETE");
    if (!result.ok) return notify(`No se pudo eliminar ${currency.code}`, "danger", result.error);
    notify(`${currency.code} eliminada`, "success");
    close();
    await mutate();
  };

  const columns: Column<Currency>[] = [
    { key: "code", label: "Código", render: (currency) => <span className={styles.strong}>{currency.code}</span> },
    { key: "name", label: "Nombre", render: (currency) => currency.name },
    { key: "symbol", label: "Símbolo", render: (currency) => currency.symbol },
    { key: "decimals", label: "Decimales", align: "end", render: (currency) => currency.decimals },
    {
      key: "active",
      label: "Activa",
      align: "center",
      render: (currency) => (
        <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Switch aria-label={`${currency.code} activa`} checked={currency.isActive} disabled={!editable} onChange={() => void toggle(currency)} />
        </span>
      ),
    },
  ];

  const field = (key: keyof Omit<Draft, "id">, label: string, extra: { inputMode?: "numeric"; maxLength?: number; help?: string } = {}) =>
    draft && (
      <Field label={label} required help={extra.help} error={showErrors ? errors?.[key] : undefined}>
        <TextInput value={draft[key]} inputMode={extra.inputMode} maxLength={extra.maxLength} autoComplete="off" onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
      </Field>
    );

  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            {editable && <Button variant="primary" onClick={() => setDraft(EMPTY)}>Nueva</Button>}
            <Breadcrumbs items={[{ label: "Configuración", href: "/settings" }, { label: "Monedas" }]} />
          </>
        }
        end={data ? <span className={styles.selection}>{data.currencies.filter((currency) => currency.isActive).length} activas de {data.currencies.length}</span> : undefined}
      />

      {error && (
        <div className={styles.alert} role="alert">
          <span>{error.message}</span>
          <Button size="sm" onClick={() => mutate()}>Reintentar</Button>
        </div>
      )}

      <div className={styles.listArea}>
        <DataTable
          caption="Monedas"
          columns={columns}
          rowKey={(currency) => currency.id}
          rowLabel={(currency) => `${currency.code} ${currency.name}`}
          rows={data?.currencies ?? []}
          onRowOpen={editable ? (currency) => setDraft({ id: currency.id, code: currency.code, name: currency.name, symbol: currency.symbol, decimals: String(currency.decimals) }) : undefined}
          rowTone={(currency) => (currency.isActive ? undefined : "muted")}
          loading={isLoading && !data}
          empty={
            <EmptyState
              icon={<Inbox size={iconSize.lg} />}
              title="Todavía no hay monedas"
              action={editable ? <Button variant="primary" onClick={() => setDraft(EMPTY)}>Nueva moneda</Button> : undefined}
            >
              Cargá las monedas con las que opera la agencia.
            </EmptyState>
          }
        />
      </div>

      <Dialog
        open={draft !== null}
        onClose={close}
        title={draft?.id ? `Editar ${draft.code}` : "Nueva moneda"}
        footer={
          <>
            <Button variant="primary" loading={busy} onClick={save}>Guardar</Button>
            <Button onClick={close}>Cancelar</Button>
            {draft?.id && (
              <Button
                variant="ghost"
                icon={<Trash2 size={iconSize.sm} />}
                onClick={() => {
                  const currency = data?.currencies.find((item) => item.id === draft.id);
                  if (currency) setToDelete(currency);
                }}
              >
                Eliminar
              </Button>
            )}
          </>
        }
      >
        <div className={styles.dialogForm}>
          {field("code", "Código", { maxLength: 10, help: "Se guarda en mayúsculas." })}
          {field("name", "Nombre", { maxLength: 100 })}
          {field("symbol", "Símbolo", { maxLength: 10 })}
          {field("decimals", "Decimales", { inputMode: "numeric", maxLength: 1, help: "Cuántos decimales se muestran y se aceptan en los importes." })}
        </div>
      </Dialog>

      <AdminConfirmDialog
        open={toDelete !== null}
        title={toDelete ? `Eliminar ${toDelete.code}` : "Eliminar moneda"}
        description="Solo se puede eliminar una moneda que nunca se usó. Si ya tiene movimientos, desactivala. Confirmá con tu contraseña."
        confirmLabel="Eliminar"
        onClose={() => setToDelete(null)}
        onConfirmed={() => {
          const currency = toDelete;
          setToDelete(null);
          if (currency) void remove(currency);
        }}
      />
    </div>
  );
}
