"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Checkbox.module.css";

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode };

export const Checkbox = forwardRef<HTMLInputElement, BaseProps & { indeterminate?: boolean }>(function Checkbox(
  { label, indeterminate = false, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  // indeterminate no existe como atributo HTML: solo se puede poner por JavaScript.
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = <input {...rest} ref={inner} type="checkbox" className={cx(styles.box, className)} />;
  if (label == null) return box;
  return (
    <label className={styles.wrap}>
      {box}
      <span>{label}</span>
    </label>
  );
});

export const Switch = forwardRef<HTMLInputElement, BaseProps>(function Switch({ label, className, ...rest }, ref) {
  const input = <input {...rest} ref={ref} type="checkbox" role="switch" className={cx(styles.switch, className)} />;
  if (label == null) return input;
  return (
    <label className={styles.wrap}>
      {input}
      <span>{label}</span>
    </label>
  );
});
