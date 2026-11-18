"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { IconButton, iconSize } from "@/components/ui";
import { useShellUser } from "./AppShell";
import styles from "./HelpTip.module.css";

// Ícono de ayuda contextual: explica qué se ve en pantalla o qué se puede hacer.
// Cada usuario lo puede apagar desde Configuración > Mi perfil.
// El texto se renderiza en un portal (no como hijo del botón) para que nunca quede
// tapado por una cabecera sticky de tabla u otro ancestro con su propio stacking context.
export function HelpTip({ children }: { children: ReactNode }) {
  const user = useShellUser();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const width = tipRef.current?.offsetWidth ?? 260;
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !tipRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
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
      {open &&
        createPortal(
          <div ref={tipRef} id={tipId} role="tooltip" className={styles.tip} style={{ top: pos.top, left: pos.left }}>
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}
