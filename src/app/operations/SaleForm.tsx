"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  MoneyInput,
  ReadonlyField,
  Select,
  Sheet,
  SheetTitle,
  SmartButton,
  SmartButtons,
  StatusBar,
  TabPanel,
  Tabs,
  TextArea,
  TextInput,
  iconSize,
  type Column,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useLeaveGuard } from "@/components/shell/LeaveGuard";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { can } from "@/lib/permissions";
import { agencyToday } from "@/lib/agency-time";
import { formatAmount } from "@/lib/format-currency";
import { parseLocaleNumber } from "@/lib/parse-number";
import { OPERATION_TYPES } from "@/lib/operation-labels";
import { AdminConfirmDialog } from "@/components/shell/AdminConfirmDialog";
import { FormPage, Notice } from "@/components/shell/FormPage";
import { contactLabel, decimalText, type ContactOption, type Currency, type OperationDetailResponse } from "./types";
import styles from "./form.module.css";

type SaleType = "SINGLE_SALE" | "DISTRIBUTED_SALE";
type Line = { key: string; clientId: string; amount: string; exchangeRate: string; isPaid: boolean; observations: string };
type Values = {
  type: SaleType;
  providerId: string;
  currencyId: string;
  exchangeRate: string;
  operationDate: string;
  providerIsPaid: "" | "true" | "false";
  providerPaymentCurrencyId: string;
  observations: string;
  lines: Line[];
};
type Errors = Partial<Record<"providerId" | "currencyId" | "exchangeRate" | "operationDate" | "providerIsPaid", string>> & { lines?: string[] };

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

// Por defecto una línea nueva queda cobrada, como en la pantalla anterior.
// La clave es local: crypto.randomUUID no existe si la app se abre sin HTTPS desde otra PC de la red.
let lineSequence = 0;
const newLine = (): Line => ({ key: `new-${++lineSequence}`, clientId: "", amount: "", exchangeRate: "", isPaid: true, observations: "" });

function valuesFrom(detail: OperationDetailResponse | undefined, type: SaleType, arsId: string): Values {
  const op = detail?.operation;
  if (!op) {
    return { type, providerId: "", currencyId: "", exchangeRate: "", operationDate: todayText(), providerIsPaid: "false", providerPaymentCurrencyId: arsId, observations: "", lines: [newLine()] };
  }
  return {
    type: op.type as SaleType,
    providerId: op.providerId ?? "",
    currencyId: op.originCurrencyId,
    exchangeRate: decimalText(op.exchangeRate),
    operationDate: op.operationDate.slice(0, 10),
    providerIsPaid: op.providerIsPaid === null ? "" : op.providerIsPaid ? "true" : "false",
    providerPaymentCurrencyId: op.providerPaymentCurrencyId ?? arsId,
    observations: op.observations ?? "",
    lines: op.childOperations.map((child) => ({
      key: child.id,
      clientId: child.clientId ?? "",
      amount: decimalText(child.originAmount),
      // Una cotización igual a la del proveedor se muestra vacía: la línea usa la general.
      exchangeRate: child.exchangeRate === op.exchangeRate ? "" : decimalText(child.exchangeRate),
      isPaid: child.isPaid,
      observations: child.observations ?? "",
    })),
  };
}

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.providerId) errors.providerId = "Elegí el proveedor.";
  if (!values.currencyId) errors.currencyId = "Elegí la moneda que se compra.";
  if (!(parseLocaleNumber(values.exchangeRate) > 0)) errors.exchangeRate = "La cotización tiene que ser mayor a cero.";
  if (!values.operationDate) errors.operationDate = "Elegí la fecha.";
  if (values.providerIsPaid === "") errors.providerIsPaid = "Indicá si el proveedor está pagado o pendiente.";
  const lines = values.lines.flatMap((line, index) => {
    const problems: string[] = [];
    if (!line.clientId) problems.push("falta el cliente");
    if (!(parseLocaleNumber(line.amount) > 0)) problems.push("el monto tiene que ser mayor a cero");
    if (line.exchangeRate.trim() && !(parseLocaleNumber(line.exchangeRate) > 0)) problems.push("la cotización no es válida");
    return problems.length ? [`Línea ${index + 1}: ${problems.join(", ")}.`] : [];
  });
  if (lines.length) errors.lines = lines;
  return errors;
}

type SaleFormProps = {
  detail?: OperationDetailResponse;
  initialType: SaleType;
  contacts: ContactOption[];
  currencies: Currency[];
  history?: ReactNode;
  onSaved: (id: string) => void;
};

export function SaleForm({ detail, initialType, contacts, currencies, history, onSaved }: SaleFormProps) {
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

  const providers = contacts.filter((contact) => contact.isProvider && (contact.isActive || contact.id === values.providerId));
  const clients = contacts.filter((contact) => contact.isClient);
  const buyable = currencies.filter((currency) => currency.code !== "ARS" && (currency.isActive || currency.id === values.currencyId));
  const payable = currencies.filter((currency) => currency.isActive && (currency.id === ars?.id || currency.id === values.currencyId));
  const currency = currencies.find((item) => item.id === values.currencyId);
  const code = currency?.code ?? "";
  const arsCode = ars?.code ?? "ARS";

  const headerRate = parseLocaleNumber(values.exchangeRate);
  const lineRate = (line: Line) => (line.exchangeRate.trim() ? parseLocaleNumber(line.exchangeRate) : headerRate);
  const lineAmount = (line: Line) => parseLocaleNumber(line.amount);
  const lineTotal = (line: Line) => lineAmount(line) * lineRate(line);
  const totalAmount = values.lines.reduce((sum, line) => sum + (lineAmount(line) || 0), 0);
  const totalArs = values.lines.reduce((sum, line) => sum + (lineTotal(line) || 0), 0);
  const providerPaid = values.providerIsPaid === "true";
  const allPaid = values.lines.every((line) => line.isPaid);
  const anyPaid = values.lines.some((line) => line.isPaid);
  // El estado no se elige: sale de los cobros y del pago al proveedor (igual que en el servidor).
  const state = allPaid && providerPaid ? "COMPLETED" : anyPaid || providerPaid ? "PARTIAL" : "PENDING";
  const payCurrency = currencies.find((item) => item.id === values.providerPaymentCurrencyId);
  const payAmount = totalAmount * (values.providerPaymentCurrencyId === ars?.id ? headerRate : 1);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));
  const setLine = (key: string, change: Partial<Line>) =>
    setValues((current) => ({ ...current, lines: current.lines.map((line) => (line.key === key ? { ...line, ...change } : line)) }));

  const save = async () => {
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      notify("Revisá los datos marcados", "warning");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(isNew ? "/api/operations/distributed-sale" : `/api/operations/distributed-sale/${op!.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationType: values.type,
          providerId: values.providerId,
          currencyId: values.currencyId,
          exchangeRate: headerRate,
          operationDate: values.operationDate,
          observations: values.observations,
          providerIsPaid: providerPaid,
          providerPaymentCurrencyId: providerPaid ? values.providerPaymentCurrencyId : "",
          providerPaymentRate: "",
          items: values.lines.map((line) => ({
            clientId: line.clientId,
            amount: lineAmount(line),
            exchangeRate: line.exchangeRate.trim() ? parseLocaleNumber(line.exchangeRate) : "",
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
      notify(isNew ? "Venta registrada" : "Cambios guardados", "success", "Los saldos de cuentas y cajas quedaron actualizados.");
      onSaved(data.parentOp?.id ?? op!.id);
    } catch {
      notify("No hay conexión con el servidor", "danger");
    } finally {
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
      width: "28%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return <span className={styles.cellText}>{contactLabel(contacts.find((contact) => contact.id === line.clientId))}</span>;
        return (
          <Select aria-label={`Cliente de la línea ${index}`} value={line.clientId} invalid={Boolean(errors.lines) && !line.clientId} onChange={(event) => setLine(line.key, { clientId: event.target.value })}>
            <option value="">Elegí un cliente</option>
            {clients
              .filter((contact) => contact.isActive || contact.id === line.clientId)
              .map((contact) => (
                <option key={contact.id} value={contact.id}>{contactLabel(contact)}</option>
              ))}
          </Select>
        );
      },
    },
    {
      key: "amount",
      label: `Monto${code ? ` (${code})` : ""}`,
      align: "end",
      width: "16%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return formatAmount(lineAmount(line), code, currency?.decimals);
        return (
          <MoneyInput
            symbol={currency?.symbol || code || "$"}
            aria-label={`Monto de la línea ${index}`}
            value={line.amount}
            invalid={Boolean(errors.lines) && !(lineAmount(line) > 0)}
            onChange={(event) => setLine(line.key, { amount: event.target.value })}
          />
        );
      },
    },
    {
      key: "rate",
      label: "Cotización",
      align: "end",
      width: "14%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        if (!editable) return decimalText(lineRate(line));
        return (
          <TextInput
            inputMode="decimal"
            aria-label={`Cotización de la línea ${index}, vacía usa la del proveedor`}
            placeholder={values.exchangeRate || "General"}
            value={line.exchangeRate}
            onChange={(event) => setLine(line.key, { exchangeRate: event.target.value })}
          />
        );
      },
    },
    { key: "total", label: "Total", align: "end", width: "16%", render: (line) => (Number.isFinite(lineTotal(line)) ? formatAmount(lineTotal(line), arsCode) : "—") },
    {
      key: "paid",
      label: "Cobrado",
      align: "center",
      width: "8%",
      render: (line) => {
        const index = values.lines.indexOf(line) + 1;
        return editable ? (
          <Checkbox aria-label={`Cobrado, línea ${index}`} checked={line.isPaid} onChange={(event) => setLine(line.key, { isPaid: event.target.checked })} />
        ) : line.isPaid ? "Sí" : "No";
      },
    },
    {
      key: "notes",
      label: "Observaciones",
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
  else if (op && op.providerIsPaid === null) notice = <Notice tone="warning">Esta venta no tiene definido si el proveedor está pagado. Elegilo antes de guardar.</Notice>;

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
      actions={
        op && can(user, "operations.delete") ? (
          <Button variant="ghost" size="sm" icon={<Trash2 size={iconSize.sm} />} loading={deleting} onClick={remove}>Eliminar</Button>
        ) : null
      }
      header={header}
      notice={notice}
      aside={history}
    >
      <Sheet>
        <SheetTitle
          eyebrow={typeLabel}
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
          <FormGroup title="Compra al proveedor">
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
                  <Select value={values.providerId} onChange={(event) => set("providerId", event.target.value)}>
                    <option value="">Elegí un proveedor</option>
                    {providers.map((contact) => (
                      <option key={contact.id} value={contact.id}>{contactLabel(contact)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Moneda" layout="inline" required error={errors.currencyId}>
                  <Select value={values.currencyId} onChange={(event) => set("currencyId", event.target.value)}>
                    <option value="">Elegí la moneda</option>
                    {buyable.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Cotización" layout="inline" required error={errors.exchangeRate} help={`Pesos por cada ${code || "unidad"}`}>
                  <TextInput inputMode="decimal" value={values.exchangeRate} onChange={(event) => set("exchangeRate", event.target.value)} />
                </Field>
                <Field label="Fecha" layout="inline" required error={errors.operationDate}>
                  <DateInput value={values.operationDate} onChange={(event) => set("operationDate", event.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <ReadonlyField label="Proveedor">{contactLabel(op?.provider) || "—"}</ReadonlyField>
                <ReadonlyField label="Moneda">{code}</ReadonlyField>
                <ReadonlyField label="Cotización">{decimalText(headerRate)}</ReadonlyField>
                <ReadonlyField label="Fecha">{values.operationDate.split("-").reverse().join("/")}</ReadonlyField>
              </>
            )}
          </FormGroup>

          <FormGroup title="Pago al proveedor">
            {editable ? (
              <>
                <Field label="Estado del pago" layout="inline" required error={errors.providerIsPaid}>
                  <Select value={values.providerIsPaid} onChange={(event) => set("providerIsPaid", event.target.value as Values["providerIsPaid"])}>
                    <option value="" disabled>Elegí una opción</option>
                    <option value="false">Pendiente</option>
                    <option value="true">Pagado</option>
                  </Select>
                </Field>
                {providerPaid && (
                  <Field label="Moneda del pago" layout="inline">
                    <Select value={values.providerPaymentCurrencyId} onChange={(event) => set("providerPaymentCurrencyId", event.target.value)}>
                      {payable.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </Select>
                  </Field>
                )}
              </>
            ) : (
              <ReadonlyField label="Estado del pago">{values.providerIsPaid === "" ? "Sin definir" : providerPaid ? "Pagado" : "Pendiente"}</ReadonlyField>
            )}
            {providerPaid && (
              <ReadonlyField label="Importe del pago">
                {Number.isFinite(payAmount) ? formatAmount(payAmount, payCurrency?.code ?? arsCode) : "—"}
              </ReadonlyField>
            )}
            <ReadonlyField label="Total de la venta">{Number.isFinite(totalArs) ? formatAmount(totalArs, arsCode) : "—"}</ReadonlyField>
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
            <DataTable
              caption="Clientes de la venta"
              columns={lineColumns}
              rowKey={(line) => line.key}
              rows={values.lines}
              totals={{ amount: formatAmount(totalAmount, code, currency?.decimals), total: Number.isFinite(totalArs) ? formatAmount(totalArs, arsCode) : "—" }}
            />
            <div className={styles.lineActions}>
              {editable && values.type === "DISTRIBUTED_SALE" ? (
                <Button variant="link" icon={<Plus size={iconSize.sm} />} onClick={() => setValues((current) => ({ ...current, lines: [...current.lines, newLine()] }))}>
                  Agregar cliente
                </Button>
              ) : (
                <span />
              )}
              <span className={styles.statusLabel}>
                {values.lines.filter((line) => line.isPaid).length} de {values.lines.length} cobradas
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
