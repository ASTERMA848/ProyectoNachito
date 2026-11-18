import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./Spinner.module.css";

export function Spinner({ label = "Cargando", size = "sm" }: { label?: string; size?: keyof typeof iconSize }) {
  return (
    <span role="status" className={styles.spinner}>
      <span className={cx(styles.ring, styles[size])} />
      <span className="ui-sr-only">{label}</span>
    </span>
  );
}
