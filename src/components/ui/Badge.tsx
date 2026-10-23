import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

// El texto tiene que decir el estado: el color solo acompaña.
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx(styles.badge, styles[tone], className)}>{children}</span>;
}

export function CounterBadge({ count, label }: { count: number; label: string }) {
  return (
    <span className={styles.counter} aria-label={`${count} ${label}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
