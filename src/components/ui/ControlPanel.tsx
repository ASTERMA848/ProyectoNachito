import type { ReactNode } from "react";
import styles from "./ControlPanel.module.css";

// Izquierda: Nuevo, migas y Acciones. Centro: buscador. Derecha: paginador y vistas.
export function ControlPanel({ start, search, end }: { start: ReactNode; search?: ReactNode; end?: ReactNode }) {
  return (
    <div className={styles.panel}>
      <div className={styles.start}>{start}</div>
      {search && <div className={styles.search}>{search}</div>}
      {end && <div className={styles.end}>{end}</div>}
    </div>
  );
}
