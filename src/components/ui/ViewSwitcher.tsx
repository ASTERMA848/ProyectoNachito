import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./ViewSwitcher.module.css";

export type ViewOption = { id: string; label: string; icon: ReactNode };

export function ViewSwitcher({ views, value, onChange }: { views: ViewOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className={styles.group} role="group" aria-label="Vista">
      {views.map((view) => {
        const active = view.id === value;
        return (
          <button
            key={view.id}
            type="button"
            className={cx(styles.button, active && styles.active)}
            aria-pressed={active}
            aria-label={view.label}
            title={view.label}
            onClick={() => onChange(view.id)}
          >
            {view.icon}
          </button>
        );
      })}
    </div>
  );
}
