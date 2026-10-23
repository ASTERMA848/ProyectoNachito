import type { ReactNode } from "react";
import styles from "./Form.module.css";

// Barra sobre la hoja: acciones a la izquierda, barra de estados a la derecha.
export function FormHeader({ actions, status }: { actions?: ReactNode; status?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className={styles.actions}>{actions}</div>
      {status && <div className={styles.status}>{status}</div>}
    </div>
  );
}

export function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className={styles.sheetWrap}>
      <div className={styles.sheet}>{children}</div>
    </div>
  );
}

export function SheetTitle({ eyebrow, children, aside }: { eyebrow?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={styles.titleRow}>
      <div className={styles.titleText}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{children}</h1>
      </div>
      {aside}
    </div>
  );
}

// Dos columnas desde lg; cada FormGroup alinea sus etiquetas en una columna de ancho automático.
export function FormGroups({ children }: { children: ReactNode }) {
  return <div className={styles.groups}>{children}</div>;
}

export function FormGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      {title && <h2 className={styles.groupTitle}>{title}</h2>}
      <div className={styles.grid}>{children}</div>
    </div>
  );
}
