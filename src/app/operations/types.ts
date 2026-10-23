// Formas que devuelven GET /api/operations/[id], /api/contacts?options=1 y /api/currencies.
export type CurrencyRef = { id: string; code: string; symbol: string; decimals: number };
export type Currency = CurrencyRef & { name: string; isActive: boolean };
export type ContactRef = { id: string; name: string; lastname?: string | null };
export type ContactOption = ContactRef & { document?: string | null; isClient: boolean; isProvider: boolean; isActive: boolean };

export type OperationLine = {
  id: string;
  operationNumber: string;
  clientId: string | null;
  client: ContactRef | null;
  originAmount: number;
  destAmount: number;
  exchangeRate: number;
  isPaid: boolean;
  observations: string | null;
};

export type OperationDetail = {
  id: string;
  operationNumber: string;
  type: string;
  state: string;
  parentOperationId: string | null;
  parentOperation: { id: string; operationNumber: string } | null;
  clientId: string | null;
  providerId: string | null;
  client: ContactRef | null;
  provider: ContactRef | null;
  originCurrencyId: string;
  destCurrencyId: string;
  originCurrency: CurrencyRef;
  destCurrency: CurrencyRef;
  originAmount: number;
  destAmount: number;
  exchangeRate: number;
  operationDate: string;
  observations: string | null;
  isPaid: boolean;
  providerIsPaid: boolean | null;
  providerPaymentCurrencyId: string | null;
  childOperations: OperationLine[];
};

export type OperationDetailResponse = { operation: OperationDetail; counts: { transactions: number; treasuryMovements: number } };

export const contactLabel = (contact: ContactRef | null | undefined) => (contact ? [contact.name, contact.lastname].filter(Boolean).join(" ") : "");

// Texto editable de un número: con separador de miles y hasta 8 decimales, como se escribe en Argentina.
export const decimalText = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? "" : value.toLocaleString("es-AR", { maximumFractionDigits: 8 });

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo cargar la información");
  return data as T;
}
