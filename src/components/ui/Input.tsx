import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type Ref,
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

// Separa los miles con "." a medida que se escribe, dejando "," para los decimales que el usuario
// decida agregar (y cuántos quiera). parseLocaleNumber ya sabe leer este mismo formato, así que el
// valor controlado sigue siendo el mismo texto, solo que con los puntos de miles puestos.
function groupThousands(raw: string): string {
  const withoutThousands = raw.replace(/\./g, "");
  const commaIndex = withoutThousands.indexOf(",");
  const intRaw = commaIndex === -1 ? withoutThousands : withoutThousands.slice(0, commaIndex);
  const decRaw = commaIndex === -1 ? "" : withoutThousands.slice(commaIndex + 1).replace(/,/g, "");
  const intDigits = intRaw.replace(/\D/g, "");
  const decDigits = decRaw.replace(/\D/g, "");
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return commaIndex === -1 ? grouped : `${grouped},${decDigits}`;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") ref(node);
      else (ref as { current: T | null }).current = node;
    });
  };
}

// Mantiene el cursor en su lugar mientras se insertan o sacan puntos de miles al tipear, en vez de
// saltar siempre al final del texto.
function useThousandsMask(onChange: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined, forwardedRef: Ref<HTMLInputElement> | undefined) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCaret.current !== null && localRef.current) {
      localRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const el = event.target;
    const caret = el.selectionStart ?? el.value.length;
    const significant = el.value.slice(0, caret).replace(/\./g, "").length;
    const formatted = groupThousands(el.value);
    let pos = formatted.length;
    if (significant === 0) {
      pos = 0;
    } else {
      let consumed = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ".") consumed++;
        if (consumed === significant) { pos = i + 1; break; }
      }
    }
    pendingCaret.current = pos;
    onChange?.({ target: { value: formatted } } as unknown as ChangeEvent<HTMLInputElement>);
  };

  return { ref: mergeRefs(localRef, forwardedRef), handleChange };
}

export type MoneyInputProps = Omit<TextInputProps, "type" | "inputMode"> & { symbol: string };

// El símbolo es decorativo: la moneda tiene que estar en la etiqueta del campo.
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { symbol, className, onChange, ...rest },
  ref,
) {
  const { ref: maskRef, handleChange } = useThousandsMask(onChange, ref);
  const style = { "--symbol-w": `${symbol.length}ch` } as CSSProperties;
  return (
    <span className={styles.money} style={style}>
      <span className={styles.symbol} aria-hidden="true">{symbol}</span>
      <TextInput {...rest} ref={maskRef} inputMode="decimal" autoComplete="off" onChange={handleChange} className={cx(styles.moneyInput, className)} />
    </span>
  );
});

export type NumberInputProps = Omit<TextInputProps, "type">;

// Como TextInput pero para importes sueltos sin símbolo de moneda (cotizaciones, cantidades): separa
// los miles en vivo igual que MoneyInput.
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { onChange, autoComplete, ...rest },
  ref,
) {
  const { ref: maskRef, handleChange } = useThousandsMask(onChange, ref);
  return <TextInput {...rest} ref={maskRef} inputMode="decimal" autoComplete={autoComplete ?? "off"} onChange={handleChange} />;
});
