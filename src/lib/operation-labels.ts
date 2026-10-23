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
};

export const isSale = (type: string) => type === "SINGLE_SALE" || type === "DISTRIBUTED_SALE";
