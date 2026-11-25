"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button, Combobox, Dialog, Field, MoneyInput, Select, TextArea, TextInput } from "@/components/ui";
import { HelpTip } from "@/components/shell/HelpTip";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { fetchList } from "@/components/shell/list-state";
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
// Con `initialBoxId` la caja viene fija (se abrió desde su tarjeta en Tesorería); sin eso,
// muestra el selector de caja (se abrió desde otra pantalla, como Operaciones).
export function CashMovementDialog({
  open,
  boxes,
  initialBoxId,
  initialType,
  onClose,
  onSaved,
}: {
  open: boolean;
  boxes: BoxOption[];
  initialBoxId?: string;
  initialType?: "INCOME" | "EXPENSE";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useUiFeedback();
  const [boxId, setBoxId] = useState(initialBoxId ?? "");
  const [type, setType] = useState(initialType ?? "INCOME");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | undefined>(undefined);
  const reopenKey = `${initialBoxId ?? ""}|${initialType ?? ""}`;
  if (open && reopenKey !== openedFor) {
    setOpenedFor(reopenKey);
    setBoxId(initialBoxId ?? "");
    setType(initialType ?? "INCOME");
  }

  const available = boxes.filter((candidate) => candidate.currency.isActive);
  const box = available.find((candidate) => candidate.id === boxId);

  const value = parseLocaleNumber(amount);
  const errors = {
    box: box ? undefined : "Elegí la caja",
    amount: !validAmount(value) ? "Escribí un importe mayor a cero" : type === "EXPENSE" && box && value > box.balance ? "Supera el saldo de la caja" : undefined,
    reason: reason.trim() ? undefined : "Escribí el motivo",
  };

  const close = () => {
    setBoxId("");
    setType("INCOME");
    setAmount("");
    setReason("");
    setShowErrors(false);
    setOpenedFor(undefined);
    onClose();
  };

  const save = async () => {
    if (!box || errors.amount || errors.reason) return setShowErrors(true);
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
      open={open}
      onClose={close}
      title={box ? `Movimiento en ${boxLabel(box)}` : "Movimiento de caja"}
      footer={
        <>
          <Button variant="primary" loading={busy} onClick={save}>Registrar</Button>
          <Button onClick={close}>Cancelar</Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        {!initialBoxId && (
          <Field label="Caja" required error={showErrors ? errors.box : undefined}>
            <Select value={boxId} onChange={(event) => setBoxId(event.target.value)}>
              <option value="">Elegí la caja</option>
              {available.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {boxLabel(candidate)} ({formatAmount(candidate.balance, candidate.currency.code, candidate.currency.decimals)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {box && <p className={styles.muted}>Saldo actual: {formatAmount(box.balance, box.currency.code, box.currency.decimals)}</p>}
        <Field
          label={
            <>
              Tipo{" "}
              <HelpTip>
                &quot;Ingreso&quot; suma al saldo de la caja (por ejemplo, plata que entró fuera de una operación). &quot;Extracción&quot;
                resta (un retiro, un gasto). Ninguno de los dos toca cuentas corrientes de contactos.
              </HelpTip>
            </>
          }
        >
          <Select value={type} onChange={(event) => setType(event.target.value as "INCOME" | "EXPENSE")}>
            <option value="INCOME">Ingreso</option>
            <option value="EXPENSE">Extracción</option>
          </Select>
        </Field>
        <Field label="Importe" required error={showErrors ? errors.amount : undefined}>
          <MoneyInput symbol={symbolOf(box)} value={amount} onChange={(event) => setAmount(event.target.value)} />
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
        <p className={styles.muted}>
          Mueve plata de una caja a otra (por ejemplo, de la caja física a la cuenta bancaria). No es una venta ni afecta a
          ningún contacto.{" "}
          <HelpTip>
            Si las dos cajas son de la misma moneda, el importe que sale es el mismo que entra. Si son de monedas distintas,
            hay que indicar la cotización para calcular cuánto entra en la caja de destino.
          </HelpTip>
        </p>
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

// Compra de USDT: se carga varias veces por día, a cotizaciones que van cambiando.
// La caja de destino es siempre la de USDT; el promedio del día lo usa la venta
// para mostrar la ganancia real de las líneas pagadas en USDT.
export function UsdtPurchaseDialog({ open, boxes, onClose, onSaved }: { open: boolean; boxes: BoxOption[]; onClose: () => void; onSaved: () => void }) {
  const { notify } = useUiFeedback();
  const [originId, setOriginId] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [usdtAmount, setUsdtAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const usdtBox = boxes.find((box) => box.currency.code === "USDT" && box.currency.isActive);
  const available = boxes.filter((box) => box.currency.isActive && box.id !== usdtBox?.id);
  const origin = available.find((box) => box.id === originId);

  const originValue = parseLocaleNumber(amount);
  const rateValue = parseLocaleNumber(rate);
  const usdtValue = parseLocaleNumber(usdtAmount);

  const recompute = (nextAmount: string, nextRate: string) => {
    const rateNumber = parseLocaleNumber(nextRate);
    if (!(rateNumber > 0)) return;
    const quotient = parseLocaleNumber(nextAmount) / rateNumber;
    if (validAmount(quotient)) setUsdtAmount(quotient.toFixed(2).replace(".", ","));
  };

  const errors = {
    origin: origin ? undefined : "Elegí con qué caja pagás",
    amount: !validAmount(originValue) ? "Escribí un importe mayor a cero" : origin && originValue > origin.balance ? "Supera el saldo de la caja" : undefined,
    rate: !validAmount(rateValue) ? "Escribí la cotización" : undefined,
    usdtAmount: !validAmount(usdtValue) ? "Escribí la cantidad de USDT recibida" : undefined,
  };

  const close = () => {
    setOriginId("");
    setAmount("");
    setRate("");
    setUsdtAmount("");
    setReason("");
    setShowErrors(false);
    onClose();
  };

  const save = async () => {
    if (!usdtBox) return notify("No hay una caja de USDT activa", "danger");
    if (Object.values(errors).some(Boolean)) return setShowErrors(true);
    setBusy(true);
    const result = await post("/api/treasury/usdt-purchase", { originAccountId: originId, originAmount: originValue, usdtAmount: usdtValue, reason });
    setBusy(false);
    if (!result.ok) return notify("No se pudo registrar la compra", "danger", result.error || "Probá de nuevo en un momento.");
    notify("Compra de USDT registrada", "success");
    close();
    onSaved();
  };

  const error = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Compra de USDT"
      footer={
        <>
          <Button variant="primary" loading={busy} onClick={save}>Registrar</Button>
          <Button onClick={close}>Cancelar</Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        <p className={styles.muted}>
          Registrá cada compra del día a su propia cotización.{" "}
          <HelpTip>
            El promedio del día (plata pagada ÷ USDT recibidos, por moneda de pago) se usa en las ventas para mostrar la
            ganancia real de las líneas en USDT ya pagadas.
          </HelpTip>
        </p>
        {usdtBox && <p className={styles.muted}>Entra a: {boxLabel(usdtBox)} ({formatAmount(usdtBox.balance, usdtBox.currency.code, usdtBox.currency.decimals)})</p>}
        <Field label="Pagás con" required error={error("origin")}>
          <Select value={originId} onChange={(event) => setOriginId(event.target.value)}>
            <option value="">Elegí la caja</option>
            {available.map((box) => (
              <option key={box.id} value={box.id}>
                {boxLabel(box)} ({formatAmount(box.balance, box.currency.code, box.currency.decimals)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label={origin ? `Importe pagado (${origin.currency.code})` : "Importe pagado"} required error={error("amount")}>
          <MoneyInput
            symbol={symbolOf(origin)}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              recompute(event.target.value, rate);
            }}
          />
        </Field>
        <Field label={`Cotización (${origin?.currency.code ?? "moneda"} por cada USDT)`} required error={error("rate")}>
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
        <Field label="USDT recibidos" required help="Se calcula con la cotización; podés corregirlo." error={error("usdtAmount")}>
          <MoneyInput symbol="USDT" value={usdtAmount} onChange={(event) => setUsdtAmount(event.target.value)} />
        </Field>
        <Field label="Motivo">
          <TextArea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

type ProviderOption = { id: string; name: string; lastname: string | null; document: string | null; isProvider: boolean; isActive: boolean };
type ProviderDebtAccount = { id: string; balance: number; currency: { id: string; code: string; symbol?: string; decimals: number } };

// Pago a un proveedor con USDT comprado en la grilla diaria: cancela su Debe (positivo = la agencia
// le debe) en la moneda que corresponda y saca el USDT de su caja. Si el Debe ya está en USDT, es
// 1 a 1; si está en otra moneda, pide una cotización para calcular cuánto USDT entregar.
export function PagarProveedorDialog({
  open,
  onClose,
  onSaved,
  fixed,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  // Desde la cuenta corriente de un proveedor, el proveedor y la moneda del Debe ya están decididos.
  fixed?: { providerId: string; currencyId: string; label: string };
}) {
  const { notify } = useUiFeedback();
  const [providerId, setProviderId] = useState(fixed?.providerId ?? "");
  const [debtCurrencyId, setDebtCurrencyId] = useState(fixed?.currencyId ?? "");
  const [debtAmount, setDebtAmount] = useState("");
  const [rate, setRate] = useState("");
  const [usdtAmount, setUsdtAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | undefined>(undefined);
  const reopenKey = `${fixed?.providerId ?? ""}|${fixed?.currencyId ?? ""}`;
  if (open && reopenKey !== openedFor) {
    setOpenedFor(reopenKey);
    setProviderId(fixed?.providerId ?? "");
    setDebtCurrencyId(fixed?.currencyId ?? "");
  }

  const providers = useSWR<{ contacts: ProviderOption[] }>(open && !fixed ? "/api/contacts?options=1" : null, fetchList);
  const debts = useSWR<{ accounts: ProviderDebtAccount[] }>(
    providerId ? `/api/accounts?filter=contact:${providerId}&filter=sign:positive` : null,
    fetchList
  );
  const debtOptions = debts.data?.accounts ?? [];
  const debtAccount = debtOptions.find((account) => account.currency.id === debtCurrencyId);
  const sameAsUsdt = debtAccount?.currency.code === "USDT";

  const debtValue = parseLocaleNumber(debtAmount);
  const rateValue = parseLocaleNumber(rate);
  const usdtValue = sameAsUsdt ? debtValue : parseLocaleNumber(usdtAmount);

  const recompute = (nextDebtAmount: string, nextRate: string) => {
    const rateNumber = parseLocaleNumber(nextRate);
    if (!(rateNumber > 0)) return;
    const quotient = parseLocaleNumber(nextDebtAmount) / rateNumber;
    if (validAmount(quotient)) setUsdtAmount(quotient.toFixed(2).replace(".", ","));
  };

  const errors = {
    provider: providerId ? undefined : "Elegí el proveedor",
    debtCurrency: providerId && !debtAccount ? "Elegí en qué moneda se cancela el Debe" : undefined,
    amount: !validAmount(debtValue) ? "Escribí un importe mayor a cero" : debtAccount && debtValue > debtAccount.balance ? "Supera el Debe de esta moneda" : undefined,
    rate: !sameAsUsdt && !validAmount(rateValue) ? "Escribí la cotización" : undefined,
    usdtAmount: !validAmount(usdtValue) ? "Escribí la cantidad de USDT a entregar" : undefined,
  };

  const close = () => {
    setProviderId(fixed?.providerId ?? "");
    setDebtCurrencyId(fixed?.currencyId ?? "");
    setDebtAmount("");
    setRate("");
    setUsdtAmount("");
    setReason("");
    setShowErrors(false);
    setOpenedFor(undefined);
    onClose();
  };

  const save = async () => {
    if (Object.values(errors).some(Boolean)) return setShowErrors(true);
    setBusy(true);
    const result = await post("/api/treasury/provider-usdt-payment", { providerId, debtCurrencyId, debtAmount: debtValue, usdtAmount: usdtValue, reason });
    setBusy(false);
    if (!result.ok) return notify("No se pudo registrar el pago", "danger", result.error || "Probá de nuevo en un momento.");
    notify("Pago a proveedor registrado", "success");
    close();
    onSaved();
  };

  const error = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);
  const providerChoices = (providers.data?.contacts ?? [])
    .filter((contact) => contact.isProvider && contact.isActive)
    .map((contact) => ({ id: contact.id, label: [contact.name, contact.lastname].filter(Boolean).join(" "), detail: contact.document ?? undefined }));

  return (
    <Dialog
      open={open}
      onClose={close}
      title={fixed ? `Pagar a ${fixed.label} con USDT` : "Pagar a proveedor con USDT"}
      footer={
        <>
          <Button variant="primary" loading={busy} onClick={save}>Registrar</Button>
          <Button onClick={close}>Cancelar</Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        <p className={styles.muted}>
          Cancela (parte de) el Debe acumulado del proveedor usando el USDT comprado en Tesorería.{" "}
          <HelpTip>
            Si el Debe de ese proveedor está en USDT, se entrega el mismo importe. Si está en otra moneda, hay que indicar
            una cotización para saber cuánto USDT entregar.
          </HelpTip>
        </p>
        {!fixed && (
          <Field label="Proveedor" required error={error("provider")}>
            <Combobox
              placeholder={providers.data ? "Buscar proveedor..." : "Cargando..."}
              value={providerId}
              options={providerChoices}
              onChange={(id) => {
                setProviderId(id);
                setDebtCurrencyId("");
                setDebtAmount("");
                setRate("");
                setUsdtAmount("");
              }}
            />
          </Field>
        )}
        {providerId && !fixed && (
          <Field label="Moneda del Debe" required error={error("debtCurrency")}>
            <Select value={debtCurrencyId} onChange={(event) => { setDebtCurrencyId(event.target.value); setDebtAmount(""); setRate(""); setUsdtAmount(""); }}>
              <option value="">{debts.data ? "Elegí la moneda" : "Cargando..."}</option>
              {debtOptions.map((account) => (
                <option key={account.currency.id} value={account.currency.id}>
                  {account.currency.code} ({formatAmount(account.balance, account.currency.code, account.currency.decimals)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {debtAccount && (
          <>
            <Field label={`Importe a saldar (${debtAccount.currency.code})`} required error={error("amount")}>
              <MoneyInput
                symbol={debtAccount.currency.symbol || debtAccount.currency.code}
                value={debtAmount}
                onChange={(event) => {
                  setDebtAmount(event.target.value);
                  if (!sameAsUsdt) recompute(event.target.value, rate);
                }}
              />
            </Field>
            {sameAsUsdt ? (
              <p className={styles.muted}>USDT a entregar: {formatAmount(debtValue || 0, "USDT", 2)}</p>
            ) : (
              <>
                <Field label={`Cotización (USDT por cada ${debtAccount.currency.code})`} required error={error("rate")}>
                  <TextInput
                    inputMode="decimal"
                    autoComplete="off"
                    value={rate}
                    onChange={(event) => {
                      setRate(event.target.value);
                      recompute(debtAmount, event.target.value);
                    }}
                  />
                </Field>
                <Field label="USDT a entregar" required help="Se calcula con la cotización; podés corregirlo." error={error("usdtAmount")}>
                  <MoneyInput symbol="USDT" value={usdtAmount} onChange={(event) => setUsdtAmount(event.target.value)} />
                </Field>
              </>
            )}
          </>
        )}
        <Field label="Motivo">
          <TextArea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
