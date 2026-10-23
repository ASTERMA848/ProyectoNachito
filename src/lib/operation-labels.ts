// Etiquetas y tonos de las operaciones. Sin dependencias del servidor: lo usan la API y la interfaz.
export const OPERATION_STATES: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PROCESSING: "En proceso",
  COMPLETED: "Completada",
  CANCELED: "Cancelada",
};

export const OPERATION_STATE_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  PARTIAL: "info",
  PROCESSING: "info",
  COMPLETED: "success",
  CANCELED: "neutral",
};

export const OPERATION_TYPES: Record<string, string> = {
  SINGLE_SALE: "Venta 1 a 1",
  DISTRIBUTED_SALE: "Venta distribuida",
  STANDARD: "Estándar",
  TREASURY_INCOME: "Ingreso de caja",
  TREASURY_EXPENSE: "Extracción de caja",
  TREASURY_TRANSFER: "Traspaso entre cajas",
};

// Las genera Tesorería al mover dinero de una caja: no se reabren ni se editan, solo se eliminan
// (eliminar revierte sus movimientos de caja).
export const TREASURY_TYPES = ["TREASURY_INCOME", "TREASURY_EXPENSE", "TREASURY_TRANSFER"];
export const isTreasury = (type: string) => TREASURY_TYPES.includes(type);
export const TREASURY_LOCKED_MESSAGE = "Las operaciones de tesorería no se reabren ni se editan. Si hay que corregirla, eliminala y cargá el movimiento de nuevo.";

export const isSale = (type: string) => type === "SINGLE_SALE" || type === "DISTRIBUTED_SALE";
