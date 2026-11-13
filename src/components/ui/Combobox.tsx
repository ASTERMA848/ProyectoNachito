"use client";

import { forwardRef, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import inputStyles from "./Input.module.css";
import styles from "./Combobox.module.css";

export type ComboOption = { id: string; label: string; detail?: string | null };

type ComboboxProps = {
  id?: string;
  value: string;
  options: ComboOption[];
  onChange: (id: string) => void;
  // Si está, al final de la lista aparece "Crear «texto»". Devuelve el id creado o null si falló.
  onCreate?: (text: string) => Promise<string | null>;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
};

const MAX_RESULTS = 8;
const CREATE = "__create__";

// Para comparar sin mayúsculas ni tildes: "benitez" encuentra a "Benítez".
export const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Campo de relación: se escribe para filtrar, flechas para moverse, Enter para elegir y Escape para cerrar.
// Patrón combobox de ARIA con lista desplegable (el foco queda en el campo).
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { id, value, options, onChange, onCreate, placeholder = "Buscar...", disabled, invalid, ...aria },
  ref,
) {
  const listId = useId();
  const selected = options.find((option) => option.id === value);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  // Mientras no se escribe, el campo muestra la opción elegida.
  const query = text ?? "";
  const results = useMemo(() => {
    const needle = normalize(query);
    const matches = needle ? options.filter((option) => normalize(`${option.label} ${option.detail ?? ""}`).includes(needle)) : options;
    return matches.slice(0, MAX_RESULTS);
  }, [options, query]);
  const canCreate = Boolean(onCreate && query.trim() && !options.some((option) => normalize(option.label) === normalize(query)));
  const items = [...results.map((option) => option.id), ...(canCreate ? [CREATE] : [])];

  const close = () => {
    setOpen(false);
    setText(null);
    setActive(0);
  };

  const choose = async (itemId: string) => {
    if (itemId === CREATE && onCreate) {
      setCreating(true);
      const created = await onCreate(query.trim());
      setCreating(false);
      if (created) onChange(created);
      close();
      return;
    }
    onChange(itemId);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      if (!items.length) return;
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (event.key === "Enter") {
      if (open && items[active]) {
        event.preventDefault();
        void choose(items[active]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
    }
  };

  const optionId = (index: number) => `${listId}-opt-${index}`;

  return (
    <span className={styles.root}>
      <input
        {...aria}
        ref={ref}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && items[active] ? optionId(active) : undefined}
        aria-invalid={invalid || aria["aria-invalid"] === true || aria["aria-invalid"] === "true" ? true : undefined}
        autoComplete="off"
        disabled={disabled || creating}
        placeholder={placeholder}
        className={cx(inputStyles.control, inputStyles.underline, styles.input)}
        value={text ?? selected?.label ?? ""}
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => clearTimeout(closeTimer.current)}
        onClick={() => setOpen(true)}
        // Se cierra un instante después para que el clic en una opción llegue antes.
        onBlur={() => {
          closeTimer.current = setTimeout(close, 150);
        }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown size={iconSize.sm} className={styles.icon} aria-hidden="true" />
      {open && (
        <ul id={listId} role="listbox" className={styles.list}>
          {results.map((option, index) => (
            <li
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={option.id === value}
              className={cx(styles.option, index === active && styles.active)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => void choose(option.id)}
            >
              <span className={styles.label}>{option.label}</span>
              {option.detail && <span className={styles.detail}>{option.detail}</span>}
            </li>
          ))}
          {canCreate && (
            <li
              id={optionId(results.length)}
              role="option"
              aria-selected={false}
              className={cx(styles.option, styles.create, active === results.length && styles.active)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(results.length)}
              onClick={() => void choose(CREATE)}
            >
              <Plus size={iconSize.sm} aria-hidden="true" />
              <span>Crear «{query.trim()}»</span>
            </li>
          )}
          {!items.length && <li className={styles.empty}>Sin resultados</li>}
        </ul>
      )}
    </span>
  );
});
