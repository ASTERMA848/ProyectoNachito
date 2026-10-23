import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { IconButton } from "./Button";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./Toast.module.css";

export type ToastTone = "info" | "success" | "warning" | "danger";

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

type ToastProps = { tone?: ToastTone; title: ReactNode; children?: ReactNode; onClose?: () => void };

export function Toast({ tone = "info", title, children, onClose }: ToastProps) {
  const Icon = ICONS[tone];
  return (
    <div className={cx(styles.toast, styles[tone])} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={iconSize.md} className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {children && <p className={styles.text}>{children}</p>}
      </div>
      {onClose && <IconButton icon={<X size={iconSize.sm} />} label="Cerrar aviso" size="sm" onClick={onClose} />}
    </div>
  );
}

// Columna fija arriba a la derecha, debajo de la barra superior. inline la deja en el flujo (para /design).
export function ToastRegion({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  return <div className={cx(styles.region, inline && styles.inline)}>{children}</div>;
}
