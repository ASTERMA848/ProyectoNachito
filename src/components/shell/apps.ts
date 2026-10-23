import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, BookMarked, BookOpen, Database, House, Landmark, Settings, ShieldCheck, Users } from "lucide-react";
import type { Role } from "@/lib/permissions";

export type AppSection = { id: string; label: string; href: string };
export type AppDef = { id: string; label: string; href: string; icon: LucideIcon; roles?: Role[]; sections?: AppSection[] };

// Aplicaciones del menú. Sin roles, la ven todos; los permisos de cada acción los decide el servidor.
export const APPS: AppDef[] = [
  { id: "home", label: "Inicio", href: "/", icon: House },
  {
    id: "operations",
    label: "Operaciones",
    href: "/operations",
    icon: ArrowLeftRight,
    sections: [
      { id: "all", label: "Operaciones", href: "/operations" },
      { id: "collect", label: "Por cobrar", href: "/operations?filter=payment:client_pending" },
      { id: "pay", label: "Por pagar", href: "/operations?filter=payment:provider_pending" },
    ],
  },
  { id: "treasury", label: "Tesorería", href: "/treasury", icon: Landmark },
  {
    id: "contacts",
    label: "Contactos",
    href: "/contacts",
    icon: Users,
    sections: [
      { id: "all", label: "Contactos", href: "/contacts" },
      { id: "clients", label: "Clientes", href: "/contacts?filter=role:client" },
      { id: "providers", label: "Proveedores", href: "/contacts?filter=role:provider" },
    ],
  },
  { id: "accounts", label: "Cuentas corrientes", href: "/accounts", icon: BookOpen },
  { id: "audit", label: "Auditoría", href: "/audit", icon: ShieldCheck, roles: ["ADMIN", "AUDITOR"] },
  { id: "sql", label: "Consola SQL", href: "/sql-console", icon: Database, roles: ["ADMIN", "AUDITOR"] },
  { id: "settings", label: "Configuración", href: "/settings", icon: Settings },
  { id: "manual", label: "Manual de uso", href: "/manual", icon: BookMarked },
];

// Pantallas que ya usan la interfaz nueva. Las demás siguen con la anterior hasta migrarlas.
const NEW_UI_PATHS = ["/operations", "/contacts", "/accounts", "/treasury", "/audit", "/settings"];

const matches = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export const usesNewUi = (pathname: string) => NEW_UI_PATHS.some((base) => matches(pathname, base));

export function appForPath(pathname: string): AppDef {
  return APPS.find((app) => app.href !== "/" && matches(pathname, app.href)) ?? APPS[0];
}

export const visibleApps = (role: string) => APPS.filter((app) => !app.roles || app.roles.includes(role as Role));

// Pantallas de la interfaz anterior a las que AUDITOR podía entrar; las nuevas ya respetan solo lectura.
const AUDITOR_LEGACY_PATHS = ["/audit", "/sql-console", "/settings", "/logout"];

export function canVisit(role: string, pathname: string) {
  const app = appForPath(pathname);
  if (app.roles && !app.roles.includes(role as Role)) return false;
  if (role === "AUDITOR" && !usesNewUi(pathname)) return pathname === "/" ? false : AUDITOR_LEGACY_PATHS.some((base) => matches(pathname, base));
  return true;
}
