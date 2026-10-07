"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useFeedback } from "@/components/FeedbackProvider";
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { formatCurrency } from "@/lib/format-currency";
import styles from "./TreasuryTransferDialog.module.css";

export type TreasuryAccount = {
  id: string;
  name: string;
  balance: number;
  currency: { id: string; code: string; decimals: number; symbol: string };
};

function format(amount: number, account: TreasuryAccount) {
  return formatCurrency(amount, account.currency.code, account.currency.decimals);
}

export default function TreasuryTransferDialog({
  accounts,
  initialOriginAccountId,
  onClose,
  onSaved,
}: {
  accounts: TreasuryAccount[];
  initialOriginAccountId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);

  const defaultOriginId = initialOriginAccountId && accounts.some((a) => a.id === initialOriginAccountId)
    ? initialOriginAccountId
    : accounts[0]?.id || "";

  const defaultDestId = accounts.find((a) => a.id !== defaultOriginId)?.id || "";

  const [originAccountId, setOriginAccountId] = useState(defaultOriginId);
  const [destAccountId, setDestAccountId] = useState(defaultDestId);

  const [originAmountStr, setOriginAmountStr] = useState("");
  const [exchangeRateStr, setExchangeRateStr] = useState("");
  const [destAmountStr, setDestAmountStr] = useState("");
  const [reason, setReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useFeedback();

  const originAccount = accounts.find((a) => a.id === originAccountId);
  const destAccount = accounts.find((a) => a.id === destAccountId);

  const isSameCurrency = originAccount && destAccount && originAccount.currency.id === destAccount.currency.id;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const calcOrigin = (destStr: string, rateStr: string) => {
    const dest = parseFloat(destStr);
    const r = parseFloat(rateStr);
    if (!isNaN(dest) && dest > 0 && !isNaN(r) && r > 0 && originAccount && destAccount) {
      let orig: number;
      if (originAccount.currency.code === "ARS" && destAccount.currency.code !== "ARS") {
        orig = dest * r;
      } else {
        orig = dest / r;
      }
      const decimals = originAccount.currency.decimals;
      setOriginAmountStr(Number(orig.toFixed(decimals)).toString());
    }
  };

  const calcDest = (origStr: string, rateStr: string) => {
    const orig = parseFloat(origStr);
    const r = parseFloat(rateStr);
    if (!isNaN(orig) && orig > 0 && !isNaN(r) && r > 0 && originAccount && destAccount) {
      let dest: number;
      if (originAccount.currency.code === "ARS" && destAccount.currency.code !== "ARS") {
        dest = orig / r;
      } else {
        dest = orig * r;
      }
      const decimals = destAccount.currency.decimals;
      setDestAmountStr(Number(dest.toFixed(decimals)).toString());
    }
  };

  const calcRate = (origStr: string, destStr: string) => {
    const orig = parseFloat(origStr);
    const dest = parseFloat(destStr);
    if (!isNaN(orig) && orig > 0 && !isNaN(dest) && dest > 0 && originAccount && destAccount) {
      let r: number;
      if (originAccount.currency.code === "ARS" && destAccount.currency.code !== "ARS") {
        r = orig / dest;
      } else {
        r = dest / orig;
      }
      setExchangeRateStr(Number(r.toFixed(4)).toString());
    }
  };

  // Synchronize when origin or dest account changes
  useEffect(() => {
    if (isSameCurrency) {
      setDestAmountStr(originAmountStr);
      setExchangeRateStr("1");
    } else if (originAmountStr && exchangeRateStr) {
      calcDest(originAmountStr, exchangeRateStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originAccountId, destAccountId]);

  const handleOriginAmountChange = (val: string) => {
    setOriginAmountStr(val);
    setError("");
    if (isSameCurrency) {
      setDestAmountStr(val);
    } else if (exchangeRateStr && parseFloat(exchangeRateStr) > 0) {
      calcDest(val, exchangeRateStr);
    } else if (destAmountStr && parseFloat(destAmountStr) > 0) {
      calcRate(val, destAmountStr);
    }
  };

  const handleExchangeRateChange = (val: string) => {
    setExchangeRateStr(val);
    setError("");
    if (isSameCurrency) return;
    if (destAmountStr && parseFloat(destAmountStr) > 0) {
      calcOrigin(destAmountStr, val);
    } else if (originAmountStr && parseFloat(originAmountStr) > 0) {
      calcDest(originAmountStr, val);
    }
  };

  const handleDestAmountChange = (val: string) => {
    setDestAmountStr(val);
    setError("");
    if (isSameCurrency) {
      setOriginAmountStr(val);
    } else if (exchangeRateStr && parseFloat(exchangeRateStr) > 0) {
      calcOrigin(val, exchangeRateStr);
    } else if (originAmountStr && parseFloat(originAmountStr) > 0) {
      calcRate(originAmountStr, val);
    }
  };

  function close() {
    if (saving.current) return;
    dialog.current?.close();
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    if (!originAccount || !destAccount) {
      setError("Seleccioná la caja de origen y la caja de destino.");
      return;
    }
    if (originAccountId === destAccountId) {
      setError("La caja de origen y la caja de destino deben ser diferentes.");
      return;
    }

    const numOrigin = Number(originAmountStr);
    const numDest = Number(destAmountStr);
    const numRate = exchangeRateStr ? Number(exchangeRateStr) : undefined;

    if (!Number.isFinite(numOrigin) || numOrigin <= 0) {
      setError("Ingresá un monto de origen mayor a cero.");
      return;
    }
    if (!Number.isFinite(numDest) || numDest <= 0) {
      setError("Ingresá un monto de destino mayor a cero.");
      return;
    }
    if (!isSameCurrency && (!Number.isFinite(numRate) || (numRate && numRate <= 0))) {
      setError("Ingresá una cotización válida mayor a cero.");
      return;
    }

    saving.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/treasury/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAccountId,
          destAccountId,
          originAmount: numOrigin,
          destAmount: numDest,
          exchangeRate: numRate,
          reason,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo registrar la transferencia.");

      notify(`Traspaso registrado correctamente de ${originAccount.name} a ${destAccount.name}.`, "success");
      onSaved();
      saving.current = false;
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intentá nuevamente.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const numOrigin = Number(originAmountStr) || 0;
  const numDest = Number(destAmountStr) || 0;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="treasury-transfer-title"
      aria-describedby="treasury-transfer-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className={styles.heading}>
        <h2 id="treasury-transfer-title">
          {isSameCurrency ? "Traspaso de Cajas" : "Conversión / Traspaso de Cajas"}
        </h2>
        <button type="button" className={styles.close} aria-label="Cerrar" onClick={close} disabled={busy}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <p id="treasury-transfer-description" className={styles.description}>
        Transferí fondos entre cajas o realizá cambios de moneda ajustando los saldos de tesorería.
      </p>

      <form onSubmit={submit} noValidate>
        <fieldset className={styles.fields} disabled={busy}>
          {/* Cajas Origen y Destino */}
          <div className={styles.grid2}>
            <div>
              <label htmlFor="origin-account">Caja Origen (sale dinero)</label>
              <select
                id="origin-account"
                className="flowbite-input"
                value={originAccountId}
                onChange={(e) => {
                  setOriginAccountId(e.target.value);
                  setError("");
                }}
                autoFocus
              >
                {accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.currency.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dest-account">Caja Destino (entra dinero)</label>
              <select
                id="dest-account"
                className="flowbite-input"
                value={destAccountId}
                onChange={(e) => {
                  setDestAccountId(e.target.value);
                  setError("");
                }}
              >
                {accounts.map((item) => (
                  <option key={item.id} value={item.id} disabled={item.id === originAccountId}>
                    {item.name} ({item.currency.code}) {item.id === originAccountId ? "(Origen)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Importes y Cotización */}
          {!isSameCurrency ? (
            <div className={styles.grid2}>
              <div>
                <label htmlFor="origin-amount">Monto enviado en {originAccount?.currency.code}</label>
                <FormattedNumberInput
                  id="origin-amount"
                  className="flowbite-input"
                  maxDecimals={originAccount?.currency.decimals ?? 2}
                  value={originAmountStr}
                  onChangeValue={(val) => handleOriginAmountChange(val)}
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label htmlFor="exchange-rate">Cotización / Tipo de Cambio</label>
                <FormattedNumberInput
                  id="exchange-rate"
                  className="flowbite-input"
                  maxDecimals={4}
                  value={exchangeRateStr}
                  onChangeValue={(val) => handleExchangeRateChange(val)}
                  placeholder="Ej: 1.250,00"
                  required
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="dest-amount">Monto recibido en {destAccount?.currency.code}</label>
                <FormattedNumberInput
                  id="dest-amount"
                  className="flowbite-input"
                  maxDecimals={destAccount?.currency.decimals ?? 2}
                  value={destAmountStr}
                  onChangeValue={(val) => handleDestAmountChange(val)}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="same-amount">Monto a transferir en {originAccount?.currency.code}</label>
              <FormattedNumberInput
                id="same-amount"
                className="flowbite-input"
                maxDecimals={originAccount?.currency.decimals ?? 2}
                value={originAmountStr}
                onChangeValue={(val) => handleOriginAmountChange(val)}
                placeholder="0,00"
                required
              />
            </div>
          )}

          {/* Previsualización de saldos */}
          {originAccount && destAccount && (
            <div className={styles.grid2}>
              <div className={styles.previewBox}>
                <div className={styles.previewBoxTitle}>
                  <span>Origen: {originAccount.name}</span>
                </div>
                <div className={styles.previewRow}>
                  <span>Saldo actual:</span>
                  <strong>{format(originAccount.balance, originAccount)}</strong>
                </div>
                <div className={styles.previewRow}>
                  <span>Saldo resultante:</span>
                  <strong style={{ color: originAccount.balance - numOrigin < 0 ? "var(--ots-danger)" : "var(--ots-text-primary)" }}>
                    {format(originAccount.balance - numOrigin, originAccount)}
                  </strong>
                </div>
              </div>

              <div className={styles.previewBox}>
                <div className={styles.previewBoxTitle}>
                  <span>Destino: {destAccount.name}</span>
                </div>
                <div className={styles.previewRow}>
                  <span>Saldo actual:</span>
                  <strong>{format(destAccount.balance, destAccount)}</strong>
                </div>
                <div className={styles.previewRow}>
                  <span>Saldo resultante:</span>
                  <strong style={{ color: destAccount.balance + numDest >= 0 ? "var(--ots-success)" : "var(--ots-danger)" }}>
                    {format(destAccount.balance + numDest, destAccount)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Motivo / Observaciones */}
          <div>
            <label htmlFor="transfer-reason">Motivo / Observaciones (opcional)</label>
            <textarea
              id="transfer-reason"
              className="flowbite-input"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: cambio de pesos a USDT para cubrir saldo o traspaso entre cajas de efectivo"
            />
          </div>
        </fieldset>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className="flowbite-btn flowbite-btn-secondary" onClick={close} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="flowbite-btn flowbite-btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? "Guardando…" : isSameCurrency ? "Confirmar traspaso" : "Confirmar conversión"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
