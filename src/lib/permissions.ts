// Matriz de permisos por rol (replica/architecture.md). La usan las rutas de la API y la interfaz.
// Leer operaciones, contactos, cuentas y tesorería solo pide una sesión iniciada.
export type Role = "ADMIN" | "OPERATOR" | "AUDITOR";

export type Permission =
  | "operations.write"
  | "operations.reopen"
  | "operations.delete"
  | "contacts.write"
  | "accounts.write"
  | "treasury.write"
  | "audit.read"
  | "sql.run"
  | "settings.write"
  | "notes.write"
  | "attachments.write";

const MATRIX: Record<Permission, readonly Role[]> = {
  "operations.write": ["ADMIN", "OPERATOR"],
  "operations.reopen": ["ADMIN"],
  "operations.delete": ["ADMIN"],
  "contacts.write": ["ADMIN", "OPERATOR"],
  "accounts.write": ["ADMIN", "OPERATOR"],
  "treasury.write": ["ADMIN", "OPERATOR"],
  "audit.read": ["ADMIN", "AUDITOR"],
  "sql.run": ["ADMIN", "AUDITOR"],
  "settings.write": ["ADMIN"],
  "notes.write": ["ADMIN", "OPERATOR", "AUDITOR"],
  "attachments.write": ["ADMIN", "OPERATOR"],
};

export function can(user: { role: string } | null | undefined, permission: Permission) {
  return Boolean(user) && (MATRIX[permission] as readonly string[]).includes(user!.role);
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administración",
  OPERATOR: "Operación",
  AUDITOR: "Auditoría",
};
