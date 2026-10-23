import Link from "next/link";
import styles from "./Breadcrumbs.module.css";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className={styles.item}>
              {last || !item.href ? (
                <span className={last ? styles.current : undefined} aria-current={last ? "page" : undefined}>{item.label}</span>
              ) : (
                <Link href={item.href} className={styles.link}>{item.label}</Link>
              )}
              {!last && <span className={styles.separator} aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
