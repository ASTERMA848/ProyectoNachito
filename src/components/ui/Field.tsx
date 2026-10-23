"use client";

import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Field.module.css";

type FieldProps = {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  // inline pone la etiqueta a la izquierda y se alinea con las demás filas del FormGroup
  layout?: "stacked" | "inline";
  children: ReactElement<any>;
};

// Conecta la etiqueta, la ayuda y el error con el control que recibe como hijo.
export function Field({ label, help, error, required, layout = "stacked", children }: FieldProps) {
  const autoId = useId();
  const controlId: string = children.props.id ?? `field${autoId}`;
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], helpId, errorId].filter(Boolean).join(" ") || undefined;

  const control = cloneElement(children, {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-required": required || children.props["aria-required"],
  });

  return (
    <div className={cx(styles.field, styles[layout])}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      <div className={styles.control}>
        {control}
        {help && <p id={helpId} className={styles.help}>{help}</p>}
        {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
      </div>
    </div>
  );
}

// Fila de solo lectura con la misma alineación que Field inline.
export function ReadonlyField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className={cx(styles.field, styles.inline)}>
      <span className={styles.label}>{label}</span>
      <div className={cx(styles.control, styles.readonly)}>{children}</div>
    </div>
  );
}
