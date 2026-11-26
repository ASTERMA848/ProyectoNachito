"use client";

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, BookOpen, Lock, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  DataTable,
  DateInput,
  Field,
  FormGroup,
  FormGroups,
  FormHeader,
  IconButton,
  Combobox,
  MoneyInput,
  NumberInput,
  ReadonlyField,
  Select,
  Sheet,
  SheetTitle,
  SmartButton,
  SmartButtons,
  StatusBar,
  TabPanel,
  Tabs,
  Tag,
  TextArea,
  TextInput,
  iconSize,
  type Column,
  type HistoryGroup,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { HelpTip } from "@/components/shell/HelpTip";
import { fetchList } from "@/components/shell/list-state";
import { useLeaveGuard } from "@/components/shell/LeaveGuard";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { can } from "@/lib/permissions";
import { agencyToday } from "@/lib/agency-time";
import { formatAmount } from "@/lib/format-currency";
import { parseLocaleNumber } from "@/lib/parse-number";
import { OPERATION_TYPE_COLORS, OPERATION_TYPES } from "@/lib/operation-labels";
import { AdminConfirmDialog } from "@/components/shell/AdminConfirmDialog";
import { FormPage, Notice } from "@/components/shell/FormPage";
import { contactChoices, contactLabel, decimalText, type ContactOption, type CreateContact, type Currency, type OperationDetailResponse } from "./types";
import styles from "./form.module.css";

type SaleType = "SINGLE_SALE" | "DISTRIBUTED_SALE";
type Line = { key: string; clientId: string; amount: string; providerExchangeRate: string; destCurrencyId: string; clientCurrencyId: string; exchangeRate: string; isPaid: boolean; observations: string; frozenRealProfitRate: number | null };
type Values = {
  type: SaleType;
  providerId: string;
  currencyId: string; // Moneda del Monto TT (lo que transfiere el proveedor)
  operationDate: string;
  observations: string;
  lines: Line[];
};
type Errors = Partial<Record<"providerId" | "currencyId" | "operationDate", string>> & { lines?: string[] };

const SALE_STEPS = [
  { id: "PENDING", label: "Pendiente" },
  { id: "PARTIAL", label: "Parcial" },
  { id: "COMPLETED", label: "Completada" },
];

const pad = (value: number) => String(value).padStart(2, "0");
const todayText = () => {
  const { year, month, day } = agencyToday();
  return `${year}-${pad(month)}-${pad(day)}`;
};

// Una línea nueva arranca sin pagar: recién se tilda cuando ya se le pagó al cliente.
// La clave es local: crypto.randomUUID no existe si la app se abre sin HTTPS desde otra PC de la red.
let lineSequence = 0;
const newLine = (destCurrencyId: string): Line => ({ key: `new-${++lineSequence}`, clientId: "", amount: "", providerExchangeRate: "", destCurrencyId, clientCurrencyId: destCurrencyId, exchangeRate: "", isPaid: false, observations: "", frozenRealProfitRate: null });

function valuesFrom(detail: OperationDetailResponse | undefined, type: SaleType, arsId: string): Values {
  const op = detail?.operation;
  if (!op) {
    return { type, providerId: "", currencyId: arsId, operationDate: todayText(), observations: "", lines: [newLine(arsId)] };
  }
  return {
    type: op.type as SaleType,
    providerId: op.providerId ?? "",
    currencyId: op.originCurrencyId,
    operationDate: op.operationDate.slice(0, 10),
    observations: op.observations ?? "",
    lines: op.childOperations.map((child) => ({
      key: child.id,
      clientId: child.clientId ?? "",
      amount: decimalText(child.originAmount),
      providerExchangeRate: decimalText(child.providerExchangeRate),
      destCurrencyId: child.destCurrencyId,
      clientCurrencyId: child.clientCurrencyId || child.destCurrencyId,
      exchangeRate: decimalText(child.exchangeRate),
      isPaid: child.isPaid,
      observations: child.observations ?? "",
      frozenRealProfitRate: child.realProfitRate,
    })),
  };
}

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.providerId) errors.providerId = "Elegí el proveedor.";
  if (!values.currencyId) errors.currencyId = "Elegí la moneda del monto transferido.";
  if (!values.operationDate) errors.operationDate = "Elegí la fecha.";
  const lines = values.lines.flatMap((line, index) => {
    const problems: string[] = [];
    if (!line.clientId) problems.push("falta el cliente");
    if (!(parseLocaleNumber(line.amount) > 0)) problems.push("el monto TT tiene que ser mayor a cero");
    if (!line.destCurrencyId) problems.push("falta la moneda del proveedor");
    if (!line.clientCurrencyId) problems.push("falta la moneda del cliente");
    const providerRate = parseLocaleNumber(line.providerExchangeRate);
    const clientRate = parseLocaleNumber(line.exchangeRate);
    if (!(providerRate > 0)) problems.push("la cotización del proveedor no es válida");
    if (!(clientRate > 0)) problems.push("la cotización del cliente no es válida");
    if (providerRate > 0 && clientRate > 0 && clientRate >= providerRate) problems.push("la cotización del cliente debe ser menor a la del proveedor");
    return problems.length ? [`Línea ${index + 1}: ${problems.join(", ")}.`] : [];
  });
  if (lines.length) errors.lines = lines;
  return errors;
}

type SaleFormProps = {
  detail?: OperationDetailResponse;
  initialType: SaleType;
  contacts: ContactOption[];
  onCreateContact?: CreateContact;
  currencies: Currency[];
  history?: ReactNode;
  historyGroups?: HistoryGroup[];
  pager?: ReactNode;
  onSaved: (id: string) => void;
};

export function SaleForm({ detail, initialType, contacts, onCreateContact, currencies, history, pager, onSaved }: SaleFormProps) {
  const router = useRouter();
  const user = useShellUser();
  const { notify, confirm } = useUiFeedback();
  const op = detail?.operation;
  const isNew = !op;

  const ars = currencies.find((currency) => currency.code === "ARS");
  const initial = useMemo(() => valuesFrom(detail, initialType, ars?.id ?? ""), [detail, initialType, ars?.id]);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [tab, setTab] = useState("lines");
  const [unlocked, setUnlocked] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Si llega otra versión del registro (después de guardar), el formulario vuelve a partir de ella.
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setValues(initial);
    setErrors({});
  }

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useLeaveGuard(dirty);

  const completed = op?.state === "COMPLETED";
  const canWrite = can(user, "operations.write");
  const canReopen = can(user, "operations.reopen");
  const editable = canWrite && (!completed || (canReopen && unlocked));

  const clientChoices = (selected: string) => contactChoices(contacts, "isClient", selected);
  const headerCurrency = currencies.find((item) => item.id === values.currencyId);
  const headerCurrencyOptions = currencies.filter((item) => item.isActive || item.id === values.currencyId);
  const lineCurrencyOptions = (selected: string) => currencies.filter((item) => item.isActive || item.id === selected);
  const currencyOf = (id: string) => currencies.find((item) => item.id === id);

  const lineAmount = (line: Line) => parseLocaleNumber(line.amount);
  const lineProviderRate = (line: Line) => parseLocaleNumber(line.providerExchangeRate);
  const lineClientRate = (line: Line) => parseLocaleNumber(line.exchangeRate);
  const lineDebe = (line: Line) => lineAmount(line) / lineProviderRate(line);
  const lineHaber = (line: Line) => lineAmount(line) / lineClientRate(line);
  const totalMontoTT = values.lines.reduce((sum, line) => sum + (lineAmount(line) || 0), 0);
  const allPaid = values.lines.every((line) => line.isPaid);
  const anyPaid = values.lines.some((line) => line.isPaid);
  const state = allPaid ? "COMPLETED" : anyPaid ? "PARTIAL" : "PENDING";

  // Promedio del día de compras de USDT (pesos u otra moneda por cada USDT), por moneda de pago.
  const { data: usdtRateData } = useSWR<{ usdtCurrencyId: string | null; rates: Record<string, number> }>("/api/treasury/usdt-rate", fetchList);
  const usdtCurrencyId = usdtRateData?.usdtCurrencyId ?? null;

  // Ganancia real de una línea cuyo proveedor cobra en USDT: Ganancia estimada (Haber − Debe) menos el
  // ajuste por lo que en verdad cuesta comprar ese USDT contra la Cot. Proveedor asumida en la línea.
  // Mientras no está pagada usa el promedio en vivo; al pagar queda fija con el promedio de ese momento.
  const lineRealProfit = (line: Line): number | null => {
    if (!usdtCurrencyId || line.destCurrencyId !== usdtCurrencyId) return null;
    const debe = lineDebe(line);
    const haber = lineHaber(line);
    const providerRate = lineProviderRate(line);
    if (!Number.isFinite(debe) || !Number.isFinite(haber) || !(providerRate > 0)) return null;
    const rate = line.isPaid && line.frozenRealProfitRate != null ? line.frozenRealProfitRate : usdtRateData?.rates?.[values.currencyId];
    if (rate === undefined || rate === null || !(rate > 0)) return null;
    const ajuste = debe * (rate - providerRate) / rate;
    return (haber - debe) - ajuste;
  };

  // Ganancia agrupada por la moneda del proveedor (Debe): es la que importa para pagarle y para la
  // ganancia real. El Haber de cada línea se suma igual aunque su Moneda Cliente sea otra (USD/USDT
  // se tratan 1 a 1), y queda a la vista en la columna "Moneda Cliente" de cada línea.
  const gananciaPorMoneda = useMemo(() => {
    const groups = new Map<string, { debe: number; haber: number; real: number; realCount: number }>();
    values.lines.forEach((line) => {
      if (!line.destCurrencyId) return;
      const debe = lineDebe(line);
      const haber = lineHaber(line);
      if (!Number.isFinite(debe) || !Number.isFinite(haber)) return;
      const group = groups.get(line.destCurrencyId) ?? { debe: 0, haber: 0, real: 0, realCount: 0 };
      group.debe += debe;
      group.haber += haber;
      const real = lineRealProfit(line);
      if (real !== null) {
        group.real += real;
        group.realCount += 1;
      }
      groups.set(line.destCurrencyId, group);
    });
    return Array.from(groups.entries()).map(([currencyId, totals]) => ({ currency: currencyOf(currencyId), ...totals, ganancia: totals.haber - totals.debe }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.lines, currencies, usdtRateData]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));
  const setLine = (key: string, change: Partial<Line>) =>
    setValues((current) => ({ ...current, lines: current.lines.map((line) => (line.key === key ? { ...line, ...change } : line)) }));

  const save = async () => {
    if (savingRef.current) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      notify("Revisá los datos marcados", "warning");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch(isNew ? "/api/operations/distributed-sale" : `/api/operations/distributed-sale/${op!.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationType: values.type,
          providerId: values.providerId,
          currencyId: values.currencyId,
          operationDate: values.operationDate,
          observations: values.observations,
          items: values.lines.map((line) => ({
            clientId: line.clientId,
            amount: lineAmount(line),
            destCurrencyId: line.destCurrencyId,
            clientCurrencyId: line.clientCurrencyId,
            providerExchangeRate: lineProviderRate(line),
            exchangeRate: lineClientRate(line),
            isPaid: line.isPaid,
            observations: line.observations,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify("No se pudo guardar", "danger", data.error || "Probá de nuevo en un momento.");
        return;
      }
      setUnlocked(false);
      notify(isNew ? "Venta registrada" : "Cambios guardados", "success", "Las cuentas corrientes quedaron actualizadas.");
      onSaved(data.parentOp?.id ?? op!.id);
    } catch {
      notify("No hay conexión con el servidor", "danger");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const discard = () => {
    setValues(initial);
    setErrors({});
  };

  const remove = async () => {
    if (!op) return;
    const accepted = await confirm(`Se eliminará ${op.operationNumber}. Se revierten sus movimientos y se ajustan los saldos. El historial se conserva.`, {
      title: "Eliminar operación",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!accepted) return;
    setDeleting(true);
    const response = await fetch(`/api/operations/${op.id}`, { method: "DELETE" }).catch(() => null);
    setDeleting(false);
    if (!response?.ok) {
      const data = await response?.json().catch(() => ({}));
      notify("No se pudo eliminar", "danger", data?.error || "Probá de nuevo en un momento.");
      return;
    }
    notify(`${op.operationNumber} eliminada`, "success", "Los saldos quedaron ajustados.");
    router.push("/operations");
  };

  const lineColumns: Column<Line>[] = [
    {
      key: "client",
      label: "Cliente",
      width: "15%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return <span className={styles.cellText}>{contactLabel(contacts.find((contact) => contact.id === line.clientId))}</span>;
        return (
          <Combobox
            aria-label={`Cliente de la línea ${index}`}
            placeholder="Buscar cliente..."
            value={line.clientId}
            options={clientChoices(line.clientId)}
            invalid={Boolean(errors.lines) && !line.clientId}
            onChange={(clientId) => setLine(line.key, { clientId })}
            onCreate={onCreateContact ? (name) => onCreateContact(name, "client") : undefined}
          />
        );
      },
    },
    {
      key: "amount",
      label: `Monto TT${headerCurrency?.code ? ` (${headerCurrency.code})` : ""}`,
      align: "end",
      width: "10%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return formatAmount(lineAmount(line), headerCurrency?.code ?? "", headerCurrency?.decimals);
        return (
          <MoneyInput
            symbol={headerCurrency?.symbol || headerCurrency?.code || "$"}
            aria-label={`Monto TT de la línea ${index}`}
            value={line.amount}
            invalid={Boolean(errors.lines) && !(lineAmount(line) > 0)}
            onChange={(event) => setLine(line.key, { amount: event.target.value })}
          />
        );
      },
    },
    {
      key: "providerRate",
      label: (
        <>
          Cot. Proveedor{" "}
          <HelpTip>
            Es la cotización con la que se calcula cuánto le quedás debiendo al proveedor por esta línea (Monto TT dividido
            esta cotización). Tiene que ser más alta que la cotización del cliente: ahí está la ganancia.
          </HelpTip>
        </>
      ),
      align: "end",
      width: "9%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return decimalText(lineProviderRate(line));
        return (
          <NumberInput
            aria-label={`Cotización del proveedor, línea ${index}`}
            invalid={Boolean(errors.lines) && !(lineProviderRate(line) > 0)}
            value={line.providerExchangeRate}
            onChange={(event) => setLine(line.key, { providerExchangeRate: event.target.value })}
          />
        );
      },
    },
    {
      key: "providerCurrency",
      label: (
        <>
          Moneda Proveedor{" "}
          <HelpTip>En qué moneda le queda debiendo la agencia al proveedor por esta línea (define el Debe).</HelpTip>
        </>
      ),
      width: "8%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return currencyOf(line.destCurrencyId)?.code ?? "—";
        return (
          <Select aria-label={`Moneda proveedor de la línea ${index}`} value={line.destCurrencyId} onChange={(event) => setLine(line.key, { destCurrencyId: event.target.value })}>
            <option value="">Elegí la moneda</option>
            {lineCurrencyOptions(line.destCurrencyId).map((item) => (
              <option key={item.id} value={item.id}>{item.code}</option>
            ))}
          </Select>
        );
      },
    },
    {
      key: "rate",
      label: (
        <>
          Coti{" "}
          <HelpTip>
            Cotización acordada con el cliente. Tiene que ser más baja que la Cot. Proveedor de esta misma línea; si no, no
            queda ganancia.
          </HelpTip>
        </>
      ),
      align: "end",
      width: "8%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        const providerRate = lineProviderRate(line);
        const clientRate = lineClientRate(line);
        if (!editable) return decimalText(clientRate);
        return (
          <NumberInput
            aria-label={`Cotización del cliente, línea ${index}`}
            invalid={Boolean(errors.lines) && (!(clientRate > 0) || (providerRate > 0 && clientRate >= providerRate))}
            value={line.exchangeRate}
            onChange={(event) => setLine(line.key, { exchangeRate: event.target.value })}
          />
        );
      },
    },
    {
      key: "clientCurrency",
      label: (
        <>
          Moneda Cliente{" "}
          <HelpTip>
            En qué moneda le queda debiendo el cliente a la agencia por esta línea (define el Haber). Normalmente es la misma
            que la Moneda Proveedor; se cambia solo cuando el proveedor le entrega al cliente en otra moneda.
          </HelpTip>
        </>
      ),
      width: "8%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return currencyOf(line.clientCurrencyId)?.code ?? "—";
        return (
          <Select aria-label={`Moneda cliente de la línea ${index}`} value={line.clientCurrencyId} onChange={(event) => setLine(line.key, { clientCurrencyId: event.target.value })}>
            <option value="">Elegí la moneda</option>
            {lineCurrencyOptions(line.clientCurrencyId).map((item) => (
              <option key={item.id} value={item.id}>{item.code}</option>
            ))}
          </Select>
        );
      },
    },
    {
      key: "debe",
      label: <>Debe <HelpTip>Lo que la agencia le queda debiendo al proveedor por esta línea: Monto TT ÷ Cot. Proveedor.</HelpTip></>,
      align: "end",
      width: "9%",
      render: (line) => (Number.isFinite(lineDebe(line)) ? formatAmount(lineDebe(line), currencyOf(line.destCurrencyId)?.code ?? "") : "—"),
    },
    {
      key: "haber",
      label: <>Haber <HelpTip>Lo que el cliente le queda debiendo a la agencia por esta línea: Monto TT ÷ Coti.</HelpTip></>,
      align: "end",
      width: "9%",
      render: (line) => (Number.isFinite(lineHaber(line)) ? formatAmount(lineHaber(line), currencyOf(line.clientCurrencyId)?.code ?? "") : "—"),
    },
    {
      key: "paid",
      label: (
        <>
          Pago{" "}
          <HelpTip>
            Marcalo cuando el cliente y el proveedor ya se arreglaron la plata directamente entre ellos: cierra el Debe y el
            Haber en sus cuentas corrientes. No mueve ninguna caja de la agencia. Si la Moneda Proveedor de la línea es USDT,
            además congela la ganancia real con el promedio de compra de USDT de ese momento.
          </HelpTip>
        </>
      ),
      align: "center",
      width: "6%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        return editable ? (
          <Checkbox aria-label={`Pago, línea ${index}`} checked={line.isPaid} onChange={(event) => setLine(line.key, { isPaid: event.target.checked })} />
        ) : line.isPaid ? "Sí" : "No";
      },
    },
    {
      key: "notes",
      label: "Observaciones",
      width: "11%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return <span className={styles.cellText}>{line.observations || "—"}</span>;
        return <TextInput aria-label={`Observaciones de la línea ${index}`} value={line.observations} onChange={(event) => setLine(line.key, { observations: event.target.value })} />;
      },
    },
  ];
  if (editable && values.type === "DISTRIBUTED_SALE") {
    lineColumns.push({
      key: "remove",
      label: "",
      width: "3%",
      render: (line) => (
        <IconButton
          icon={<Trash2 size={iconSize.sm} />}
          label={`Quitar la línea ${values.lines.indexOf(line) + 1}`}
          size="sm"
          disabled={values.lines.length === 1}
          onClick={() => setValues((current) => ({ ...current, lines: current.lines.filter((item) => item.key !== line.key) }))}
        />
      ),
    });
  }

  const typeLabel = OPERATION_TYPES[values.type] ?? "Venta";
  const title = op?.operationNumber ?? (values.type === "SINGLE_SALE" ? "Nueva venta 1 a 1" : "Nueva venta distribuida");

  let notice: ReactNode = null;
  if (!canWrite) notice = <Notice>Tu rol puede consultar las operaciones pero no modificarlas.</Notice>;
  else if (completed && !canReopen) notice = <Notice>Esta venta está completada. Solo un administrador puede modificarla.</Notice>;

  const header = (
    <FormHeader
      actions={
        editable ? (
          <>
            <Button variant="primary" loading={saving} disabled={!isNew && !dirty} onClick={save}>
              {isNew ? "Registrar venta" : "Guardar"}
            </Button>
            {isNew ? (
              <Button onClick={() => router.push("/operations")}>Cancelar</Button>
            ) : (
              dirty && <Button onClick={discard}>Descartar</Button>
            )}
          </>
        ) : completed && canReopen ? (
          <Button icon={<Lock size={iconSize.sm} />} onClick={() => setUnlockOpen(true)}>Editar operación completada</Button>
        ) : null
      }
      status={<StatusBar steps={SALE_STEPS} current={state} label="Estado de la venta" />}
    />
  );

  return (
    <FormPage
      breadcrumbs={[{ label: "Operaciones", href: "/operations" }, { label: title }]}
      dirty={dirty}
      pager={pager}
      actions={
        <>
          <HelpTip>
            El cliente le manda el Monto TT directo al proveedor, y el proveedor le entrega el cambio directo al cliente: la
            agencia no toca esa plata. Por cada línea queda registrado lo que la agencia le debe al proveedor (Debe) y lo que
            el cliente le queda debiendo a la agencia (Haber); la diferencia es la ganancia. Tildar &quot;Pago&quot; solo
            cierra esas cuentas corrientes, no mueve ninguna caja. Para pagarle al proveedor con el USDT comprado en
            Tesorería, usá &quot;Pagar a proveedor&quot;.
          </HelpTip>
          {op && can(user, "operations.delete") && (
            <Button variant="ghost" size="sm" icon={<Trash2 size={iconSize.sm} />} loading={deleting} onClick={remove}>Eliminar</Button>
          )}
        </>
      }
      header={header}
      notice={notice}
      aside={history}
    >
      <Sheet wide>
        <SheetTitle
          eyebrow={<Tag color={OPERATION_TYPE_COLORS[values.type] ?? "gray"}>{typeLabel}</Tag>}
          aside={
            detail ? (
              <SmartButtons>
                <SmartButton icon={<BookOpen size={iconSize.md} />} value={detail.counts.transactions} label="Movimientos de cuenta" href="/accounts" />
                <SmartButton icon={<ArrowLeftRight size={iconSize.md} />} value={detail.counts.treasuryMovements} label="Movimientos de caja" href="/treasury" />
              </SmartButtons>
            ) : undefined
          }
        >
          {title}
        </SheetTitle>

        <FormGroups>
          <FormGroup title="Proveedor">
            {isNew && (
              <Field label="Tipo" layout="inline">
                <Select
                  value={values.type}
                  onChange={(event) => {
                    const type = event.target.value as SaleType;
                    setValues((current) => ({ ...current, type, lines: type === "SINGLE_SALE" ? current.lines.slice(0, 1) : current.lines }));
                  }}
                >
                  <option value="SINGLE_SALE">Venta 1 a 1 (un cliente)</option>
                  <option value="DISTRIBUTED_SALE">Venta distribuida (varios clientes)</option>
                </Select>
              </Field>
            )}
            {editable ? (
              <>
                <Field label="Proveedor" layout="inline" required error={errors.providerId}>
                  <Combobox
                    placeholder="Buscar proveedor..."
                    value={values.providerId}
                    options={contactChoices(contacts, "isProvider", values.providerId)}
                    onChange={(providerId) => set("providerId", providerId)}
                    onCreate={onCreateContact ? (name) => onCreateContact(name, "provider") : undefined}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Moneda{" "}
                      <HelpTip>La moneda en la que el proveedor transfiere el Monto TT a los clientes (normalmente pesos).</HelpTip>
                    </>
                  }
                  layout="inline"
                  required
                  error={errors.currencyId}
                >
                  <Select value={values.currencyId} onChange={(event) => set("currencyId", event.target.value)}>
                    <option value="">Elegí la moneda</option>
                    {headerCurrencyOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Fecha" layout="inline" required error={errors.operationDate}>
                  <DateInput value={values.operationDate} onChange={(event) => set("operationDate", event.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <ReadonlyField label="Proveedor">{contactLabel(op?.provider) || "—"}</ReadonlyField>
                <ReadonlyField label="Moneda">{headerCurrency?.code}</ReadonlyField>
                <ReadonlyField label="Fecha">{values.operationDate.split("-").reverse().join("/")}</ReadonlyField>
              </>
            )}
            <ReadonlyField label="Total Monto TT">{Number.isFinite(totalMontoTT) ? formatAmount(totalMontoTT, headerCurrency?.code ?? "", headerCurrency?.decimals) : "—"}</ReadonlyField>
          </FormGroup>

          <FormGroup
            title={
              <>
                Ganancia{" "}
                <HelpTip>
                  Agrupa las líneas por moneda: no se suman monedas distintas entre sí. Cada dato de abajo explica cómo se
                  calcula con su propio signo de pregunta.
                </HelpTip>
              </>
            }
          >
            {gananciaPorMoneda.length ? (
              gananciaPorMoneda.map(({ currency, debe, haber, ganancia }) => (
                <Fragment key={currency?.id ?? "—"}>
                  {gananciaPorMoneda.length > 1 && <p className={styles.gananciaCurrency}>{currency?.code ?? "—"}</p>}
                  <ReadonlyField
                    label={
                      <>
                        Debe{" "}
                        <HelpTip>
                          Suma de lo que la agencia le queda debiendo al proveedor en todas las líneas de esta moneda: por
                          cada línea, Monto TT ÷ Cot. Proveedor.
                        </HelpTip>
                      </>
                    }
                  >
                    {formatAmount(debe, currency?.code ?? "")}
                  </ReadonlyField>
                  <ReadonlyField
                    label={
                      <>
                        Haber{" "}
                        <HelpTip>
                          Suma de lo que los clientes le quedan debiendo a la agencia en todas las líneas de esta moneda de
                          proveedor: por cada línea, Monto TT ÷ Coti, en la Moneda Cliente de esa línea (USD y USDT se tratan
                          1 a 1 si difieren de esta moneda).
                        </HelpTip>
                      </>
                    }
                  >
                    {formatAmount(haber, currency?.code ?? "")}
                  </ReadonlyField>
                  <ReadonlyField
                    label={
                      <>
                        Ganancia{" "}
                        <HelpTip>Haber menos Debe: la diferencia entre lo que el cliente le debe a la agencia y lo que la agencia le debe al proveedor.</HelpTip>
                      </>
                    }
                  >
                    {formatAmount(ganancia, currency?.code ?? "")}
                  </ReadonlyField>
                </Fragment>
              ))
            ) : (
              <ReadonlyField label="—">Cargá al menos una línea con montos y cotizaciones válidas.</ReadonlyField>
            )}
          </FormGroup>
        </FormGroups>

        <Tabs
          idPrefix="sale"
          label="Secciones de la venta"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "lines", label: values.type === "SINGLE_SALE" ? "Cliente" : `Clientes (${values.lines.length})` },
            { id: "notes", label: "Observaciones" },
          ]}
        />
        <TabPanel idPrefix="sale" tabId="lines" active={tab === "lines"}>
          {errors.lines && (
            <ul className={styles.lineErrors} role="alert">
              {errors.lines.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          <div className={styles.lines}>
            <DataTable caption="Clientes de la venta" columns={lineColumns} rowKey={(line) => line.key} rows={values.lines} resizableColumns />
            <div className={styles.lineActions}>
              {editable && values.type === "DISTRIBUTED_SALE" ? (
                <Button variant="link" icon={<Plus size={iconSize.sm} />} onClick={() => setValues((current) => ({ ...current, lines: [...current.lines, newLine(values.currencyId)] }))}>
                  Agregar cliente
                </Button>
              ) : (
                <span />
              )}
              <span className={styles.statusLabel}>
                {values.lines.filter((line) => line.isPaid).length} de {values.lines.length} pagadas
              </span>
            </div>
          </div>
        </TabPanel>
        <TabPanel idPrefix="sale" tabId="notes" active={tab === "notes"}>
          {editable ? (
            <TextArea aria-label="Observaciones de la venta" rows={4} value={values.observations} onChange={(event) => set("observations", event.target.value)} />
          ) : (
            <p className={styles.muted}>{values.observations || "Sin observaciones."}</p>
          )}
        </TabPanel>
      </Sheet>

      <AdminConfirmDialog
        open={unlockOpen}
        title="Editar una venta completada"
        description="Modificar una venta completada revierte y vuelve a registrar sus movimientos. Confirmá con tu contraseña."
        confirmLabel="Habilitar edición"
        onClose={() => setUnlockOpen(false)}
        onConfirmed={() => {
          setUnlockOpen(false);
          setUnlocked(true);
        }}
      />
    </FormPage>
  );
}
