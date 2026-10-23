import { cx } from "./cx";
import styles from "./StatusBar.module.css";

export type StatusStep = { id: string; label: string };

type StatusBarProps = { steps: StatusStep[]; current: string; onSelect?: (id: string) => void; label?: string };

// Pasos en forma de flecha. Con onSelect los demás pasos son botones; sin él, solo se muestran.
export function StatusBar({ steps, current, onSelect, label = "Estado" }: StatusBarProps) {
  return (
    <ol className={styles.bar} aria-label={label}>
      {steps.map((step) => {
        const active = step.id === current;
        const content = <span className={styles.inner}>{step.label}</span>;
        return (
          <li key={step.id} className={cx(styles.step, active && styles.current)} aria-current={active ? "step" : undefined}>
            {onSelect && !active ? (
              <button type="button" className={styles.button} onClick={() => onSelect(step.id)}>
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
