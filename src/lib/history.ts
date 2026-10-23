import type { AuditLog } from "@prisma/client";
import { formatTime } from "@/lib/agency-time";
import { formatMoney } from "@/lib/format-currency";
import { OPERATION_STATES, OPERATION_TYPES } from "@/lib/operation-labels";

// Entradas del historial de un registro. Se arman al vuelo desde AuditLog: no hay tabla aparte.
export type HistoryEntry =
  | { id: string; kind: "change"; author: string; at: string; changes: { field: string; from: string; to: string }[] }
  | { id: string; kind: "event"; author: string; at: string; text: string };

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  lastname: "Apellido",
  document: "Documento",
  cuitCuil: "CUIT/CUIL",
  phone: "Teléfono",
  email: "Email",
  isClient: "Cliente",
  isProvider: "Proveedor",
  isActive: "Activo",
  balance: "Saldo",
  state: "Estado",
  isPaid: "Cobrado",
  providerIsPaid: "Pago al proveedor",
  originAmount: "Monto",
  destAmount: "Total en pesos",
  exchangeRate: "Cotización",
  totalAmount: "Monto total",
  itemCount: "Líneas",
  observations: "Observaciones",
  operationDate: "Fecha",
};

const MONEY_FIELDS = new Set(["originAmount", "destAmount", "totalAmount", "balance"]);

// Cómo se nombra cada tipo de registro en las frases del historial.
const NOUNS: Record<string, { article: string; noun: string }> = {
  Operation: { article: "la", noun: "operación" },
  Contact: { article: "el", noun: "contacto" },
  TreasuryAccount: { article: "la", noun: "caja" },
  User: { article: "el", noun: "usuario" },
  Currency: { article: "la", noun: "moneda" },
  Tag: { article: "la", noun: "etiqueta" },
  Transaction: { article: "el", noun: "movimiento de cuenta" },
  TreasuryMovement: { article: "el", noun: "movimiento de caja" },
  TreasuryTransfer: { article: "el", noun: "traspaso entre cajas" },
  Settings: { article: "la", noun: "configuración" },
};
const nounOf = (entity: string | null) => NOUNS[entity ?? ""] ?? { article: "el", noun: "registro" };

function parse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Sin definir";
  if (field === "state") return OPERATION_STATES[String(value)] ?? String(value);
  if (field === "type") return OPERATION_TYPES[String(value)] ?? String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (MONEY_FIELDS.has(field) && typeof value === "number") return formatMoney(value);
  return String(value);
}

const label = (field: string) => FIELD_LABELS[field] ?? field;

type LogWithUser = AuditLog & { user: { username: string } | null };

// detailed: valores anteriores y nuevos (ADMIN y AUDITOR). Sin él, solo qué campos cambiaron.
export function describeAuditLog(log: LogWithUser, detailed: boolean): HistoryEntry {
  const base = { id: log.id, author: log.user?.username ?? "Sistema", at: formatTime(log.createdAt) };
  const before = parse(log.oldValues);
  const after = parse(log.newValues);
  const { article, noun } = nounOf(log.entity);
  const reference = typeof after?.operationNumber === "string" ? ` ${after.operationNumber}` : typeof after?.name === "string" ? ` ${after.name}` : "";

  if (log.action === "LOGIN") return { ...base, kind: "event", text: "Inició sesión." };
  if (log.action === "SQL_QUERY") {
    const blocked = log.query?.startsWith("[BLOQUEADO]");
    return { ...base, kind: "event", text: blocked ? "Intentó una consulta SQL que se bloqueó." : "Ejecutó una consulta en la consola SQL." };
  }

  if (log.action === "CREATE") {
    const amount = after?.totalAmount ?? after?.originAmount ?? after?.amount;
    const suffix = detailed && typeof amount === "number" ? ` por ${formatMoney(amount)}` : "";
    return { ...base, kind: "event", text: `Registró ${article} ${noun}${reference}${suffix}.` };
  }
  if (log.action === "DELETE") {
    const extra = log.entity === "Operation" ? " y revirtió sus saldos" : "";
    return { ...base, kind: "event", text: `Eliminó ${article} ${noun}${extra}.` };
  }

  if (before && after) {
    const fields = Object.keys(after).filter((field) => field in before && JSON.stringify(before[field]) !== JSON.stringify(after[field]));
    if (fields.length && detailed) {
      return { ...base, kind: "change", changes: fields.map((field) => ({ field: label(field), from: formatValue(field, before[field]), to: formatValue(field, after[field]) })) };
    }
    if (fields.length) return { ...base, kind: "event", text: `Modificó: ${fields.map(label).join(", ")}.` };
  }

  // Las ventas guardan solo el estado nuevo: se resume lo que quedó.
  if (after && detailed && "state" in after) {
    const parts = [`estado ${formatValue("state", after.state)}`];
    if (typeof after.itemCount === "number") parts.push(`${after.itemCount} ${after.itemCount === 1 ? "línea" : "líneas"}`);
    if ("providerIsPaid" in after) parts.push(`pago al proveedor: ${formatValue("providerIsPaid", after.providerIsPaid)}`);
    return { ...base, kind: "event", text: `Actualizó ${article} ${noun}: ${parts.join(", ")}.` };
  }
  return { ...base, kind: "event", text: `Actualizó ${article} ${noun}.` };
}
