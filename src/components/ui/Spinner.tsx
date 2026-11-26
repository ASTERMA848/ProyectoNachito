import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./Spinner.module.css";

// SVG en vez del truco de borde: un círculo con `border-top-color: transparent` no se anima fluido,
// se ve "a los saltos" porque el navegador no puede suavizar bien las puntas del arco al rotar. El
// trazo de un <circle> sí se redondea y rota sin parpadear.
export function Spinner({ label = "Cargando", size = "sm" }: { label?: string; size?: keyof typeof iconSize }) {
  return (
    <span role="status" className={styles.spinner}>
      <svg className={cx(styles.ring, styles[size])} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="47 16" />
      </svg>
      <span className="ui-sr-only">{label}</span>
    </span>
  );
}
