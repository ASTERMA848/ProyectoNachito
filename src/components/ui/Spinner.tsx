import { LoaderCircle } from "lucide-react";
import { iconSize } from "./tokens.generated";
import styles from "./Spinner.module.css";

export function Spinner({ label = "Cargando", size = "sm" }: { label?: string; size?: keyof typeof iconSize }) {
  return (
    <span role="status" className={styles.spinner}>
      <LoaderCircle size={iconSize[size]} className={styles.icon} />
      <span className="ui-sr-only">{label}</span>
    </span>
  );
}
