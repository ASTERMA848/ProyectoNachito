"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, BookOpen, Trash2 } from "lucide-react";
import {
  Button,
  DateInput,
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
  StatusBar,
  TextArea,
  TextInput,
  iconSize,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useLeaveGuard } from "@/components/shell/LeaveGuard";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { can } from "@/lib/permissions";
import { formatAmount } from "@/lib/format-currency";
import { parseLocaleNumber } from "@/lib/parse-number";
import { isTreasury, OPERATION_STATES, OPERATION_TYPES, TREASURY_LOCKED_MESSAGE } from "@/lib/operation-labels";
import { AdminConfirmDialog } from "@/components/shell/AdminConfirmDialog";
import { FormPage, Notice } from "@/components/shell/FormPage";
import { contactLabel, decimalText, type ContactOption, type Currency, type OperationDetailResponse } from "./types";

type Values = {
  clientId: string;
  providerId: string;
  originCurrencyId: string;
  originAmount: string;
  destCurrencyId: string;
  destAmount: string;
  exchangeRate: string;
  operationDate: string;
  observations: string;
};

const valuesFrom = ({ operation: op }: OperationDetailResponse): Values => ({
  clientId: op.clientId ?? "",
  providerId: op.providerId ?? "",
  originCurrencyId: op.originCurrencyId,
  originAmount: decimalText(op.originAmount),
  destCurrencyId: op.destCurrencyId,
  destAmount: decimalText(op.destAmount),
  exchangeRate: decimalText(op.exchangeRate),
  operationDate: op.operationDate.slice(0, 10),
  observations: op.observations ?? "",
});

type StandardFormProps = { detail: OperationDetailResponse; contacts: ContactOption[]; currencies: Currency[]; history?: ReactNode; onSaved: () => void };

// Operaciones estándar anteriores a las ventas: el estado se cambia a mano, como en la pantalla anterior.
export function StandardForm({ detail, contacts, currencies, history, onSaved }: StandardFormProps) {
  const router = useRouter();
  const user = useShellUser();
  const { notify, confirm } = useUiFeedback();
  const op = detail.operation;

  const initial = useMemo(() => valuesFrom(detail), [detail]);
  const [values, setValues] = useState(initial);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setValues(initial);
  }
  const [busy, setBusy] = useState(false);
  const [reopenTo, setReopenTo] = useState<string | null>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useLeaveGuard(dirty);

  const completed = op.state === "COMPLETED";
  const canWrite = can(user, "operations.write");
  const canReopen = can(user, "operations.reopen");
  const treasury = isTreasury(op.type);
  const editable = canWrite && !treasury && (!completed || canReopen);
  const set = (key: keyof Values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const steps = [
    { id: "PENDING", label: "Pendiente" },
    { id: "PROCESSING", label: "En proceso" },
    { id: "COMPLETED", label: "Completada" },
    ...(op.state === "CANCELED" ? [{ id: "CANCELED", label: "Cancelada" }] : []),
  ];

  const patchState = async (state: string) => {
    setBusy(true);
    const response = await fetch(`/api/operations/${op.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    }).catch(() => null);
    setBusy(false);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      notify("No se pudo cambiar el estado", "danger", data?.error || "Probá de nuevo en un momento.");
      return;
    }
    notify(`Estado: ${OPERATION_STATES[state] ?? state}`, "success");
    onSaved();
  };

  const changeState = async (state: string) => {
    if (dirty) return notify("Guardá o descartá los cambios antes de cambiar el estado", "warning");
    if (completed) return setReopenTo(state);
    if (state === "CANCELED") {
      const accepted = await confirm(`Se cancelará ${op.operationNumber}.`, { title: "Cancelar operación", confirmLabel: "Cancelar operación", danger: true });
      if (!accepted) return;
    }
    await patchState(state);
  };

  const save = async () => {
    const origin = parseLocaleNumber(values.originAmount);
    const dest = parseLocaleNumber(values.destAmount);
    const rate = parseLocaleNumber(values.exchangeRate);
    if (!(origin > 0 && dest > 0 && rate > 0)) return notify("Los montos y la cotización tienen que ser mayores a cero", "warning");
    setBusy(true);
    const response = await fetch(`/api/operations/${op.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, originAmount: origin, destAmount: dest, exchangeRate: rate }),
    }).catch(() => null);
    setBusy(false);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return notify("No se pudo guardar", "danger", data?.error || "Probá de nuevo en un momento.");
    notify("Cambios guardados", "success");
    onSaved();
  };

  const remove = async () => {
    const accepted = await confirm(`Se eliminará ${op.operationNumber}. Se revierten sus movimientos y se ajustan los saldos. El historial se conserva.`, {
      title: "Eliminar operación",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!accepted) return;
    const response = await fetch(`/api/operations/${op.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) return notify("No se pudo eliminar", "danger");
    notify(`${op.operationNumber} eliminada`, "success");
    router.push("/operations");
  };

  const select = (key: keyof Values, options: { id: string; label: string }[], placeholder: string) => (
    <Select value={values[key]} onChange={(event) => set(key, event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </Select>
  );
  const contactOptions = (kind: "isClient" | "isProvider", selected: string) =>
    contacts.filter((contact) => contact[kind] && (contact.isActive || contact.id === selected)).map((contact) => ({ id: contact.id, label: contactLabel(contact) }));
  const currencyOptions = currencies.map((currency) => ({ id: currency.id, label: currency.code }));

  const header = (
    <FormHeader
      actions={
        editable ? (
          <>
            {dirty && <Button variant="primary" loading={busy} onClick={save}>Guardar</Button>}
            {dirty && <Button onClick={() => setValues(initial)}>Descartar</Button>}
            {!dirty && !completed && op.state !== "CANCELED" && <Button variant="primary" loading={busy} onClick={() => changeState("COMPLETED")}>Completar</Button>}
            {!dirty && !completed && op.state !== "CANCELED" && <Button onClick={() => changeState("CANCELED")}>Cancelar operación</Button>}
            {!dirty && (completed || op.state === "CANCELED") && <Button onClick={() => changeState("PENDING")}>Reabrir</Button>}
          </>
        ) : null
      }
      status={<StatusBar steps={steps} current={op.state} label="Estado de la operación" onSelect={editable && !dirty ? changeState : undefined} />}
    />
  );

  return (
    <FormPage
      breadcrumbs={[{ label: "Operaciones", href: "/operations" }, { label: op.operationNumber }]}
      dirty={dirty}
      actions={can(user, "operations.delete") ? <Button variant="ghost" size="sm" icon={<Trash2 size={iconSize.sm} />} onClick={remove}>Eliminar</Button> : null}
      header={header}
      notice={
        treasury ? (
          <Notice>{TREASURY_LOCKED_MESSAGE}</Notice>
        ) : !canWrite ? (
          <Notice>Tu rol puede consultar las operaciones pero no modificarlas.</Notice>
        ) : completed && !canReopen ? (
          <Notice>Esta operación está completada. Solo un administrador puede modificarla.</Notice>
        ) : null
      }
      aside={history}
    >
      <Sheet>
        <SheetTitle
          eyebrow={treasury ? OPERATION_TYPES[op.type] : "Operación estándar"}
          aside={
            <SmartButtons>
              <SmartButton icon={<BookOpen size={iconSize.md} />} value={detail.counts.transactions} label="Movimientos de cuenta" href="/accounts" />
              <SmartButton icon={<ArrowLeftRight size={iconSize.md} />} value={detail.counts.treasuryMovements} label="Movimientos de caja" href="/treasury" />
            </SmartButtons>
          }
        >
          {op.operationNumber}
        </SheetTitle>
        {editable && !completed ? (
          <FormGroups>
            <FormGroup title="Partes">
              <Field label="Cliente" layout="inline">{select("clientId", contactOptions("isClient", values.clientId), "Elegí un cliente")}</Field>
              <Field label="Proveedor" layout="inline">{select("providerId", contactOptions("isProvider", values.providerId), "Elegí un proveedor")}</Field>
              <Field label="Fecha" layout="inline">
                <DateInput value={values.operationDate} onChange={(event) => set("operationDate", event.target.value)} />
              </Field>
            </FormGroup>
            <FormGroup title="Importes">
              <Field label="Moneda que entrega" layout="inline">{select("originCurrencyId", currencyOptions, "Elegí la moneda")}</Field>
              <Field label="Monto que entrega" layout="inline">
                <TextInput inputMode="decimal" value={values.originAmount} onChange={(event) => set("originAmount", event.target.value)} />
              </Field>
              <Field label="Moneda que recibe" layout="inline">{select("destCurrencyId", currencyOptions, "Elegí la moneda")}</Field>
              <Field label="Monto que recibe" layout="inline">
                <TextInput inputMode="decimal" value={values.destAmount} onChange={(event) => set("destAmount", event.target.value)} />
              </Field>
              <Field label="Cotización" layout="inline">
                <TextInput inputMode="decimal" value={values.exchangeRate} onChange={(event) => set("exchangeRate", event.target.value)} />
              </Field>
            </FormGroup>
          </FormGroups>
        ) : (
          <FormGroups>
            <FormGroup title="Partes">
              <ReadonlyField label="Cliente">{contactLabel(op.client) || "—"}</ReadonlyField>
              <ReadonlyField label="Proveedor">{contactLabel(op.provider) || "—"}</ReadonlyField>
              <ReadonlyField label="Fecha">{values.operationDate.split("-").reverse().join("/")}</ReadonlyField>
            </FormGroup>
            <FormGroup title="Importes">
              <ReadonlyField label="Entrega">{formatAmount(op.originAmount, op.originCurrency.code, op.originCurrency.decimals)}</ReadonlyField>
              <ReadonlyField label="Recibe">{formatAmount(op.destAmount, op.destCurrency.code, op.destCurrency.decimals)}</ReadonlyField>
              <ReadonlyField label="Cotización">{decimalText(op.exchangeRate)}</ReadonlyField>
            </FormGroup>
          </FormGroups>
        )}
        <Field label="Observaciones">
          <TextArea rows={3} value={values.observations} disabled={!editable || completed} onChange={(event) => set("observations", event.target.value)} />
        </Field>
      </Sheet>

      <AdminConfirmDialog
        open={reopenTo !== null}
        title="Reabrir una operación completada"
        description="Al reabrirla se revierten sus movimientos en cuentas y cajas. Confirmá con tu contraseña."
        confirmLabel="Reabrir"
        onClose={() => setReopenTo(null)}
        onConfirmed={() => {
          const state = reopenTo;
          setReopenTo(null);
          if (state) void patchState(state);
        }}
      />
    </FormPage>
  );
}
