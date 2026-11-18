"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { IconButton, iconSize } from "@/components/ui";
import { useShellUser } from "./AppShell";
import styles from "./HelpTip.module.css";

// Ícono de ayuda contextual: explica qué se ve en pantalla o qué se puede hacer.
// Cada usuario lo puede apagar desde Configuración > Mi perfil.
export function HelpTip({ children }: { children: ReactNode }) {
  const user = useShellUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (user.showHelpTips === false) return null;

  return (
    <span ref={rootRef} className={styles.root}>
      <IconButton
        icon={<CircleHelp size={iconSize.xs} />}
        label="Ayuda"
        size="sm"
        variant="ghost"
        className={styles.trigger}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div id={tipId} role="tooltip" className={styles.tip}>
          {children}
        </div>
      )}
    </span>
  );
}
