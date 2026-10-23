"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button, Dialog, Field, Select, TextArea, TextInput } from "@/components/ui";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { fetchList } from "@/components/shell/list-state";
import { parseLocaleNumber } from "@/lib/parse-number";
import styles from "./accounts.module.css";

type ContactOption = { id: string; name: string; lastname: string | null; document: string | null };
type CurrencyOption = { id: string; code: string; isActive: boolean };

type MovementDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (accountId: string) => void;
  // Desde una cuenta abierta, el contacto y la moneda ya están decididos.
  fixed?: { contactId: string; currencyId: string; label: string };
};

const EMPTY = { contactId: "", currencyId: "", type: "CREDIT", amount: "", concept: "", observations: "" };

// Carga manual en una cuenta corriente: ajustes, pagos a cuenta o saldos iniciales.
export function MovementDialog({ open, onClose, onSaved, fixed }: MovementDialogProps) {
  const { notify } = useUiFeedback();
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const contacts = useSWR<{ contacts: ContactOption[] }>(open && !fixed ? "/api/contacts?options=1" : null, fetchList);
  const currencies = useSWR<{ currencies: CurrencyOption[] }>(open && !fixed ? "/api/currencies" : null, fetchList);

  const set = (key: keyof typeof EMPTY, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const amount = parseLocaleNumber(values.amount);
  const contactId = fixed?.contactId ?? values.contactId;
  const currencyId = fixed?.currencyId ?? values.currencyId;
  const errors = {
    contact: contactId ? undefined : "Elegí el contacto",
    currency: currencyId ? undefined : "Elegí la moneda",
    amount: amount > 0 && Number.isFinite(amount) ? undefined : "Escribí un monto mayor a cero",
    concept: values.concept.trim() ? undefined : "Escribí el concepto",
  };

  const close = () => {
    setValues(EMPTY);
    setShowErrors(false);
    onClose();
  };

  const save = async () => {
    if (Object.values(errors).some(Boolean)) return setShowErrors(true);
    setBusy(true);
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, currencyId, type: values.type, amount, concept: values.concept, observations: values.observations }),
    }).catch(() => null);
    setBusy(false);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) return notify("No se pudo cargar el movimiento", "danger", data?.error || "Probá de nuevo en un momento.");
    notify("Movimiento cargado", "success");
    setValues(EMPTY);
    setShowErrors(false);
    onSaved(data.account.id);
  };

  const error = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);

  return (
    <Dialog
      open={open}
      onClose={close}
      title={fixed ? `Movimiento en ${fixed.label}` : "Nuevo movimiento"}
      footer={
        <>
          <Button variant="primary" loading={busy} onClick={save}>Cargar</Button>
          <Button onClick={close}>Cancelar</Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        {!fixed && (
          <>
            <Field label="Contacto" required error={error("contact")}>
              <Select value={values.contactId} onChange={(event) => set("contactId", event.target.value)}>
                <option value="">{contacts.data ? "Elegí un contacto" : "Cargando..."}</option>
                {contacts.data?.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {[contact.name, contact.lastname].filter(Boolean).join(" ")}
                    {contact.document ? ` (${contact.document})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda" required error={error("currency")}>
              <Select value={values.currencyId} onChange={(event) => set("currencyId", event.target.value)}>
                <option value="">{currencies.data ? "Elegí la moneda" : "Cargando..."}</option>
                {currencies.data?.currencies
                  .filter((currency) => currency.isActive)
                  .map((currency) => (
                    <option key={currency.id} value={currency.id}>{currency.code}</option>
                  ))}
              </Select>
            </Field>
          </>
        )}
        <Field label="Tipo" help={values.type === "CREDIT" ? "Suma al saldo: la agencia le debe más al contacto." : "Resta del saldo: el contacto le debe más a la agencia."}>
          <Select value={values.type} onChange={(event) => set("type", event.target.value)}>
            <option value="CREDIT">Haber (a favor del contacto)</option>
            <option value="DEBIT">Debe (en contra del contacto)</option>
          </Select>
        </Field>
        <Field label="Monto" required error={error("amount")}>
          <TextInput inputMode="decimal" autoComplete="off" value={values.amount} onChange={(event) => set("amount", event.target.value)} />
        </Field>
        <Field label="Concepto" required error={error("concept")}>
          <TextInput maxLength={500} value={values.concept} onChange={(event) => set("concept", event.target.value)} />
        </Field>
        <Field label="Observaciones">
          <TextArea rows={2} maxLength={2000} value={values.observations} onChange={(event) => set("observations", event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
