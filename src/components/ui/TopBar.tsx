"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Menu as MenuIcon } from "lucide-react";
import { IconButton } from "./Button";
import { Menu, type MenuEntry } from "./Menu";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./TopBar.module.css";

export type TopBarSection = { id: string; label: string; href?: string; active?: boolean; items?: MenuEntry[] };

// apps: si se pasa, el botón de la grilla abre un menú con las aplicaciones; si no, llama a onOpenApps.
type TopBarProps = { appName: string; sections?: TopBarSection[]; apps?: MenuEntry[]; onOpenApps?: () => void; end?: ReactNode };

export function TopBar({ appName, sections = [], apps, onOpenApps, end }: TopBarProps) {
  const router = useRouter();
  // En pantallas chicas los menús de sección se juntan en un solo desplegable.
  const compactItems: MenuEntry[] = sections.flatMap((section) =>
    section.items
      ? [{ type: "heading" as const, id: `${section.id}-heading`, label: section.label }, ...section.items]
      : [{ id: section.id, label: section.label, onSelect: () => section.href && router.push(section.href) }],
  );

  return (
    <header className={styles.bar}>
      <nav aria-label="Principal" className={styles.nav}>
        {apps ? (
          <Menu label="Menú de aplicaciones" icon={<LayoutGrid size={iconSize.md} />} items={apps} />
        ) : (
          <IconButton icon={<LayoutGrid size={iconSize.md} />} label="Menú de aplicaciones" onClick={onOpenApps} />
        )}
        <span className={styles.app}>{appName}</span>
        {sections.length > 0 && (
          <>
            <ul className={styles.sections}>
              {sections.map((section) => (
                <li key={section.id}>
                  {section.items ? (
                    <Menu label={section.label} items={section.items}>{section.label}</Menu>
                  ) : (
                    <Link
                      href={section.href ?? "/"}
                      className={cx(styles.section, section.active && styles.active)}
                      aria-current={section.active ? "page" : undefined}
                    >
                      {section.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <div className={styles.compact}>
              <Menu label="Secciones" icon={<MenuIcon size={iconSize.md} />} items={compactItems} />
            </div>
          </>
        )}
      </nav>
      {end && <div className={styles.end}>{end}</div>}
    </header>
  );
}
