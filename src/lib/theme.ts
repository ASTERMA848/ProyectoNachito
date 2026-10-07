export type UserTheme = "LIGHT" | "DARK";
export const THEME_CHANGED_EVENT = "agency:theme-changed";

// Las preferencias antiguas SYSTEM conservan el aspecto claro predeterminado.
export function resolveTheme(preference?: string): UserTheme {
  return preference === "DARK" ? "DARK" : "LIGHT";
}

export function applyTheme(preference?: string) {
  const theme = resolveTheme(preference);
  document.documentElement.classList.toggle("dark", theme === "DARK");
  document.documentElement.classList.toggle("light", theme === "LIGHT");
}
