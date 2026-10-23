import {
  forwardRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./Input.module.css";

// underline es el campo de formulario (solo línea inferior); boxed, el de buscadores y diálogos.
type Look = { variant?: "underline" | "boxed"; invalid?: boolean };

const ariaInvalid = (invalid: boolean | undefined, fromProps: unknown) =>
  invalid || fromProps === true || fromProps === "true" ? true : undefined;

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & Look;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { variant = "underline", invalid, className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      {...rest}
      ref={ref}
      type={type}
      className={cx(styles.control, styles[variant], className)}
      aria-invalid={ariaInvalid(invalid, rest["aria-invalid"])}
    />
  );
});

export const DateInput = forwardRef<HTMLInputElement, Omit<TextInputProps, "type">>(function DateInput(props, ref) {
  return <TextInput {...props} ref={ref} type="date" />;
});

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Look;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { variant = "underline", invalid, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      className={cx(styles.control, styles.area, styles[variant], className)}
      aria-invalid={ariaInvalid(invalid, rest["aria-invalid"])}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & Look;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { variant = "underline", invalid, className, children, ...rest },
  ref,
) {
  return (
    <span className={styles.selectWrap}>
      <select
        {...rest}
        ref={ref}
        className={cx(styles.control, styles.select, styles[variant], className)}
        aria-invalid={ariaInvalid(invalid, rest["aria-invalid"])}
      >
        {children}
      </select>
      <ChevronDown size={iconSize.sm} className={styles.selectIcon} />
    </span>
  );
});

export type MoneyInputProps = Omit<TextInputProps, "type" | "inputMode"> & { symbol: string };

// El símbolo es decorativo: la moneda tiene que estar en la etiqueta del campo.
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { symbol, className, ...rest },
  ref,
) {
  const style = { "--symbol-w": `${symbol.length}ch` } as CSSProperties;
  return (
    <span className={styles.money} style={style}>
      <span className={styles.symbol} aria-hidden="true">{symbol}</span>
      <TextInput {...rest} ref={ref} inputMode="decimal" autoComplete="off" className={cx(styles.moneyInput, className)} />
    </span>
  );
});
