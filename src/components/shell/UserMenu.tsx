"use client";

import { LogOut, Moon, Sun, User } from "lucide-react";
import { Avatar, Menu, iconSize } from "@/components/ui";
import { applyTheme, THEME_CHANGED_EVENT } from "@/lib/theme";
import { ROLE_LABELS } from "@/lib/permissions";
import { useLeaveGuardContext } from "./LeaveGuard";
import { useUiFeedback } from "./UiFeedback";

export type ShellUser = { id: string; username: string; role: string; theme?: string; profilePicture?: string | null };

export function UserMenu({ user }: { user: ShellUser }) {
  const { navigate } = useLeaveGuardContext();
  const { notify } = useUiFeedback();
  const dark = user.theme === "DARK";

  const toggleTheme = async () => {
    const theme = dark ? "LIGHT" : "DARK";
    applyTheme(theme);
    const response = await fetch("/api/auth/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    }).catch(() => null);
    if (!response?.ok) {
      applyTheme(user.theme);
      notify("No se pudo guardar el tema", "danger", "Probá de nuevo en un momento.");
      return;
    }
    // MainLayout guarda el tema del usuario y lo vuelve a aplicar en cada pantalla.
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { userId: user.id, theme } }));
  };

  return (
    <Menu
      label={`Menú de ${user.username}`}
      align="end"
      items={[
        { type: "heading", id: "who", label: `${user.username} · ${ROLE_LABELS[user.role] ?? user.role}` },
        { id: "profile", label: "Mi perfil", icon: <User size={iconSize.sm} />, onSelect: () => void navigate("/settings/profile") },
        {
          id: "theme",
          label: dark ? "Usar tema claro" : "Usar tema oscuro",
          icon: dark ? <Sun size={iconSize.sm} /> : <Moon size={iconSize.sm} />,
          onSelect: toggleTheme,
        },
        { type: "divider", id: "divider" },
        { id: "logout", label: "Cerrar sesión", icon: <LogOut size={iconSize.sm} />, onSelect: () => void navigate("/logout") },
      ]}
    >
      <Avatar name={user.username} src={user.profilePicture} />
    </Menu>
  );
}
