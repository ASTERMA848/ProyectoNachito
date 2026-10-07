"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useFeedback } from "@/components/FeedbackProvider";
import styles from "./TreasuryMovementDialog.module.css";

export type TreasuryAccount = {
  id: string; name: string; balance: number;
  currency: { code: string; decimals: number };
};

function format(amount: number, account: TreasuryAccount) {
  return `${amount.toLocaleString("es-AR", { maximumFractionDigits: account.currency.decimals })} ${account.currency.code}`;
}

export default function TreasuryMovementDialog({ accounts, initialAccountId, onClose, onSaved }: {
  accounts: TreasuryAccount[]; initialAccountId: string; onClose: () => void;
  onSaved: (result: { account: TreasuryAccount; movement: any }) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);
  const [accountId, setAccountId] = useState(initialAccountId);
  const [type, setType] = useState("INCOME");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useFeedback();
  const account = accounts.find(item => item.id === accountId);
  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount > 0;

  useEffect(() => { dialog.current?.showModal(); }, []);
  function close() {
    if (saving.current) return;
    dialog.current?.close();
    onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    if (!account) { setError("Seleccioná una cuenta disponible."); return; }
    if (!validAmount) { setError("Ingresá un importe mayor a cero."); return; }
    if (!reason.trim()) { setError("Escribí el motivo del movimiento."); return; }
    if (type === "EXPENSE" && numericAmount > account.balance) { setError("El importe supera el saldo disponible de esta cuenta."); return; }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/treasury", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, type, amount: numericAmount, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el movimiento.");
      onSaved(result);
      notify(`${type === "INCOME" ? "Ingreso" : "Extracción"} registrado en ${account.name}.`, "success");
      saving.current = false;
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intentá nuevamente.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="treasury-movement-title" aria-describedby="treasury-movement-description"
    onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.heading}>
      <h2 id="treasury-movement-title">Ingreso o extracción</h2>
      <button type="button" className={styles.close} aria-label="Cerrar" onClick={close} disabled={busy}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <p id="treasury-movement-description" className={styles.description}>Registrá dinero que entra o sale de una cuenta, con su motivo.</p>
    <form onSubmit={submit} noValidate>
      <fieldset className={styles.fields} disabled={busy}>
        <div><label htmlFor="treasury-account">Cuenta y moneda</label>
          <select id="treasury-account" className="flowbite-input" value={accountId} onChange={event => { setAccountId(event.target.value); setAmount(""); setError(""); }} autoFocus>
            {accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.currency.code}</option>)}
          </select>
        </div>
        <div><label htmlFor="treasury-type">Movimiento</label>
          <select id="treasury-type" className="flowbite-input" value={type} onChange={event => { setType(event.target.value); setError(""); }}>
            <option value="INCOME">Ingreso</option><option value="EXPENSE">Extracción</option>
          </select>
        </div>
        <div><label htmlFor="treasury-amount">Importe {account ? `en ${account.currency.code}` : ""}</label>
          <input id="treasury-amount" className="flowbite-input" type="number" inputMode="decimal" min={account ? 10 ** -account.currency.decimals : 0.01}
            step={account ? 10 ** -account.currency.decimals : 0.01} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0" required />
          {account && <div className={styles.balance}>
            <span>Saldo actual <strong>{format(account.balance, account)}</strong></span>
            {validAmount && <span>Saldo después <strong>{format(account.balance + (type === "INCOME" ? numericAmount : -numericAmount), account)}</strong></span>}
          </div>}
        </div>
        <div><label htmlFor="treasury-reason">Motivo</label>
          <textarea id="treasury-reason" className="flowbite-input" rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)}
            placeholder="Ej.: aporte de efectivo o retiro del titular" required />
        </div>
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className="flowbite-btn flowbite-btn-secondary" onClick={close} disabled={busy}>Cancelar</button>
        <button type="submit" className="flowbite-btn flowbite-btn-primary" disabled={busy} aria-busy={busy}>
          {busy ? "Guardando…" : type === "INCOME" ? "Registrar ingreso" : "Registrar extracción"}
        </button>
      </div>
    </form>
  </dialog>;
}
