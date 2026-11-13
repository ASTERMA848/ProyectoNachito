"use client";

import { useState } from "react";
import { Button, Dialog, Field, MoneyInput, Select, TextArea, TextInput } from "@/components/ui";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { formatAmount } from "@/lib/format-currency";
import { parseLocaleNumber } from "@/lib/parse-number";
import styles from "./treasury.module.css";

export type BoxOption = { id: string; name: string; balance: number; currency: { id: string; code: string; symbol?: string; decimals: number; isActive: boolean } };

const boxLabel = (box: BoxOption) => `${box.name} · ${box.currency.code}`;
const symbolOf = (box: BoxOption | undefined) => box?.currency.symbol || box?.currency.code || "$";
const validAmount = (value: number) => Number.isFinite(value) && value > 0;

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  return { ok: Boolean(response?.ok), error: data?.error as string | undefined };
}

// Ingreso o extracción manual en una caja (con motivo, queda como operación de tesorería).
export function CashMovementDialog({ box, onClose, onSaved }: { box: BoxOption | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useUiFeedback();
  const [type, setType] = useState("INCOME");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const value = parseLocaleNumber(amount);
  const errors = {
    amount: !validAmount(value) ? "Escribí un importe mayor a cero" : type === "EXPENSE" && box && value > box.balance ? "Supera el saldo de la caja" : undefined,
    reason: reason.trim() ? undefined : "Escribí el motivo",
  };

  const close = () => {
    setType("INCOME");
    setAmount("");
    setReason("");
    setShowErrors(false);
    onClose();
  };

  const save = async () => {
    if (!box) return;
    if (errors.amount || errors.reason) return setShowErrors(true);
    setBusy(true);
    const result = await post("/api/treasury", { accountId: box.id, type, amount: value, reason });
    setBusy(false);
    if (!result.ok) return notify("No se pudo registrar el movimiento", "danger", result.error || "Probá de nuevo en un momento.");
    notify(type === "INCOME" ? "Ingreso registrado" : "Extracción registrada", "success");
    close();
    onSaved();
  };

  return (
    <Dialog
      open={box !== null}
      onClose={close}
      title={box ? `Movimiento en ${boxLabel(box)}` : "Movimiento"}
      footer={
        <>
          <Button variant="primary" loading={busy} onClick={save}>Registrar</Button>
          <Button onClick={close}>Cancelar</Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        {box && <p className={styles.muted}>Saldo actual: {formatAmount(box.balance, box.currency.code, box.currency.decimals)}</p>}
        <Field label="Tipo">
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="INCOME">Ingreso</option>
            <option value="EXPENSE">Extracción</option>
          </Select>
        </Field>
        <Field label="Importe" required error={showErrors ? errors.amount : undefined}>
          <MoneyInput symbol={symbolOf(box ?? undefined)} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Motivo" required error={showErrors ? errors.reason : undefined}>
          <TextArea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

// Traspaso entre cajas; si cambian de moneda, el importe que entra sale de la cotización.
export function TransferDialog({ open, boxes, from, onClose, onSaved }: { open: boolean; boxes: BoxOption[]; from?: string; onClose: () => void; onSaved: () => void }) {
  const { notify } = useUiFeedback();
  const [originId, setOriginId] = useState(from ?? "");
  const [destId, setDestId] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [destAmount, setDestAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [openedFrom, setOpenedFrom] = useState<string | undefined>(undefined);
  if (open && from !== openedFrom) {
    setOpenedFrom(from);
    setOriginId(from ?? "");
  }

  const available = boxes.filter((box) => box.currency.isActive);
  const origin = available.find((box) => box.id === originId);
  const dest = available.find((box) => box.id === destId);
  const crossCurrency = Boolean(origin && dest && origin.currency.id !== dest.currency.id);

  const originValue = parseLocaleNumber(amount);
  const rateValue = parseLocaleNumber(rate);
  const destValue = crossCurrency ? parseLocaleNumber(destAmount) : originValue;

  const recompute = (nextAmount: string, nextRate: string) => {
    const product = parseLocaleNumber(nextAmount) * parseLocaleNumber(nextRate);
    if (validAmount(product) && dest) setDestAmount(product.toFixed(dest.currency.decimals).replace(".", ","));
  };

  const errors = {
    origin: origin ? undefined : "Elegí la caja que entrega",
    dest: !dest ? "Elegí la caja que recibe" : dest.id === origin?.id ? "Tiene que ser otra caja" : undefined,
    amount: !validAmount(originValue) ? "Escribí un importe mayor a cero" : origin && originValue > origin.balance ? "Supera el saldo de la caja" : undefined,
    rate: crossCurrency && !validAmount(rateValue) ? "Escribí la cotización" : undefined,
    destAmount: crossCurrency && !validAmount(destValue) ? "Escribí el importe que recibe" : undefined,
  };

  const close = () => {
    setOriginId("");
    setDestId("");
    setAmount("");
    setRate("");
    setDestAmount("");
    setReason("");
    setShowErrors(false);
    setOpenedFrom(undefined);
    onClose();
  };

  const save = async () => {
    if (Object.values(errors).some(Boolean)) return setShowErrors(true);
    setBusy(true);
    const result = await post("/api/treasury/transfer", {
      originAccountId: originId,
      destAccountId: destId,
      originAmount: originValue,
      destAmount: destValue,
      exchangeRate: crossCurrency ? rateValue : undefined,
      reason,
    });
    setBusy(false);
    if (!result.ok) return notify("No se pudo registrar el traspaso", "danger", result.error || "Probá de nuevo en un momento.");
    notify("Traspaso registrado", "success");
    close();
    onSaved();
  };

  const error = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);
  const options = (exclude?: string) =>
    available
      .filter((box) => box.id !== exclude)
      .map((box) => (
        <option key={box.id} value={box.id}>
          {boxLabel(box)} ({formatAmount(box.balance, box.currency.code, box.currency.decimals)})
        </option>
      ));

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Traspaso entre cajas"
      footer={
        <>
          <Button variant="primary" loading={busy} onClick={save}>Registrar</Button>
          <Button onClick={close}>Cancelar</Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        <Field label="Desde" required error={error("origin")}>
          <Select value={originId} onChange={(event) => setOriginId(event.target.value)}>
            <option value="">Elegí la caja</option>
            {options()}
          </Select>
        </Field>
        <Field label="Hacia" required error={error("dest")}>
          <Select
            value={destId}
            onChange={(event) => {
              setDestId(event.target.value);
              setDestAmount("");
            }}
          >
            <option value="">Elegí la caja</option>
            {options(originId)}
          </Select>
        </Field>
        <Field label={origin ? `Importe que sale (${origin.currency.code})` : "Importe que sale"} required error={error("amount")}>
          <MoneyInput
            symbol={symbolOf(origin)}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              if (crossCurrency) recompute(event.target.value, rate);
            }}
          />
        </Field>
        {crossCurrency && origin && dest && (
          <>
            <Field label={`Cotización (${dest.currency.code} por cada ${origin.currency.code})`} required error={error("rate")}>
              <TextInput
                inputMode="decimal"
                autoComplete="off"
                value={rate}
                onChange={(event) => {
                  setRate(event.target.value);
                  recompute(amount, event.target.value);
                }}
              />
            </Field>
            <Field label={`Importe que entra (${dest.currency.code})`} required help="Se calcula con la cotización; podés corregirlo." error={error("destAmount")}>
              <MoneyInput symbol={symbolOf(dest)} value={destAmount} onChange={(event) => setDestAmount(event.target.value)} />
            </Field>
          </>
        )}
        <Field label="Motivo">
          <TextArea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
