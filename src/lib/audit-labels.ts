// Nombres legibles de las acciones y los tipos de registro de AuditLog.
export const AUDIT_ACTIONS: Record<string, string> = {
  CREATE: "Alta",
  UPDATE: "Modificación",
  UPDATE_STATE_OR_PAY: "Cambio de estado o pago",
  DELETE: "Baja",
  LOGIN: "Inicio de sesión",
  SQL_QUERY: "Consulta SQL",
  REPORT: "Informe",
};

export const AUDIT_ENTITIES: Record<string, string> = {
  Operation: "Operación",
  Contact: "Contacto",
  Tag: "Etiqueta",
  Transaction: "Movimiento de cuenta",
  TreasuryMovement: "Movimiento de caja",
  TreasuryTransfer: "Traspaso entre cajas",
  TreasuryAccount: "Caja",
  Currency: "Moneda",
  User: "Usuario",
  Settings: "Configuración",
  Session: "Sesión",
};
