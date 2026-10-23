"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, IconButton, type ButtonSize, type ButtonVariant } from "./Button";
import { cx } from "./cx";
import styles from "./Menu.module.css";

export type MenuEntry =
  | { type?: "item"; id: string; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | { type: "divider"; id: string }
  | { type: "heading"; id: string; label: string };

type MenuProps = {
  label: string;
  items: MenuEntry[];
  // Sin children el botón es solo ícono y usa label como nombre accesible.
  children?: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  align?: "start" | "end";
};

const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)';

export function Menu({ label, items, children, icon, variant = "ghost", size = "md", align = "start" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR) ?? []);
  const focusAt = (index: number) => {
    const list = menuItems();
    if (list.length) list[(index + list.length) % list.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>(ITEM_SELECTOR)?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = menuItems();
    const current = list.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Tab") return setOpen(false);
    const target = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: list.length - 1 }[event.key];
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (target !== undefined) {
      event.preventDefault();
      focusAt(target);
    }
  };

  const triggerProps = {
    ref: buttonRef,
    variant,
    size,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
    onClick: () => setOpen((value) => !value),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown" && !open) {
        event.preventDefault();
        setOpen(true);
      }
    },
  };

  return (
    <div ref={rootRef} className={styles.root}>
      {children == null ? (
        <IconButton {...triggerProps} icon={icon} label={label} />
      ) : (
        <Button {...triggerProps} icon={icon} aria-label={label === children ? undefined : label}>
          {children}
        </Button>
      )}
      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label={label} className={cx(styles.menu, styles[align])} onKeyDown={onMenuKeyDown}>
          {items.map((item) => {
            if (item.type === "divider") return <div key={item.id} role="separator" className={styles.divider} />;
            if (item.type === "heading") return <div key={item.id} role="presentation" className={styles.heading}>{item.label}</div>;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className={cx(styles.item, item.danger && styles.danger)}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
