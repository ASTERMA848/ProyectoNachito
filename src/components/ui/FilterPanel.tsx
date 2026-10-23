"use client";

import { useId, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./FilterPanel.module.css";

export type PanelOption = { id: string; label: string; active?: boolean; options?: PanelOption[]; expanded?: boolean };

export type PanelSection = {
  id: string;
  title: string;
  icon: ReactNode;
  iconTone?: "accent" | "action" | "warning";
  // Cada grupo se separa con una línea. En Filtros, las opciones del mismo grupo se combinan con O.
  groups: PanelOption[][];
  footerAction?: { label: string; onClick: () => void };
};

type FilterPanelProps = {
  sections: PanelSection[];
  onToggle: (sectionId: string, optionId: string) => void;
  onExpand?: (sectionId: string, optionId: string) => void;
};

export function FilterPanel({ sections, onToggle, onExpand }: FilterPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.columns}>
        {sections.map((section) => (
          <Section key={section.id} section={section} onToggle={onToggle} onExpand={onExpand} />
        ))}
      </div>
    </div>
  );
}

function Section({ section, onToggle, onExpand }: { section: PanelSection } & Omit<FilterPanelProps, "sections">) {
  const titleId = useId();
  const option = (item: PanelOption, nested = false) => {
    const hasChildren = Boolean(item.options?.length);
    const active = hasChildren ? item.options!.some((child) => child.active) : Boolean(item.active);
    return (
      <li key={item.id}>
        <button
          type="button"
          className={cx(styles.option, nested && styles.nested, active && styles.active)}
          aria-pressed={hasChildren ? undefined : active}
          aria-expanded={hasChildren ? Boolean(item.expanded) : undefined}
          onClick={() => (hasChildren ? onExpand?.(section.id, item.id) : onToggle(section.id, item.id))}
        >
          <span className={styles.check}>{active && <Check size={iconSize.sm} />}</span>
          <span className={styles.optionLabel}>{item.label}</span>
          {hasChildren && <ChevronDown size={iconSize.sm} className={cx(styles.caret, item.expanded && styles.caretOpen)} />}
        </button>
        {hasChildren && item.expanded && <ul className={styles.group}>{item.options!.map((child) => option(child, true))}</ul>}
      </li>
    );
  };

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        <span className={cx(styles.titleIcon, styles[section.iconTone ?? "accent"])} aria-hidden="true">{section.icon}</span>
        {section.title}
      </h3>
      {section.groups.map((group, index) => (
        <ul key={index} className={styles.group}>
          {group.map((item) => option(item))}
        </ul>
      ))}
      {section.footerAction && (
        <button type="button" className={cx(styles.option, styles.footer)} onClick={section.footerAction.onClick}>
          <span className={styles.check} />
          {section.footerAction.label}
        </button>
      )}
    </section>
  );
}
