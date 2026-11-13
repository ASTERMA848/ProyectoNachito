import { Prisma } from "@prisma/client";

// La escala de la base es 8. Se conserva precisión intermedia para multiplicar
// dos valores de hasta 30 dígitos antes de redondear el importe registrado.
Prisma.Decimal.set({ precision: 64 });

type MonetaryJson<T> = T extends Prisma.Decimal ? number
  : T extends Date ? T
  : T extends object ? { [K in keyof T]: MonetaryJson<T[K]> }
  : T;

// Conserva el contrato numérico de la API. Los cálculos y las escrituras usan Decimal.
export function monetaryJson<T>(value: T): MonetaryJson<T>;
export function monetaryJson(value: unknown): unknown {
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(monetaryJson);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, monetaryJson(entry)]));
  }
  return value;
}

export function positiveDecimal(value: unknown, places = 8) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).trim();
  if (text.length > 64 || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const amount = new Prisma.Decimal(text);
  return amount.isFinite() && amount.gt(0) && amount.lt(1e22) && amount.decimalPlaces() <= places ? amount : null;
}
