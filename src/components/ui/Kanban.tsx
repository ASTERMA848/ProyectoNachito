"use client";

import { useId, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { IconButton } from "./Button";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./Kanban.module.css";

export type ProgressSegment = { id: string; tone: "success" | "warning" | "danger" | "neutral"; count: number; label: string };

export function KanbanBoard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={styles.board} role="region" aria-label={label}>
      {children}
    </div>
  );
}

type KanbanColumnProps = {
  title: string;
  count: number;
  total?: ReactNode;
  progress?: ProgressSegment[];
  onQuickCreate?: () => void;
  children?: ReactNode;
};

export function KanbanColumn({ title, count, total, progress, onQuickCreate, children }: KanbanColumnProps) {
  const headingId = useId();
  const progressTotal = progress?.reduce((sum, segment) => sum + segment.count, 0) ?? 0;
  return (
    <section className={styles.column} aria-labelledby={headingId}>
      <header className={styles.head}>
        <h3 id={headingId} className={styles.title}>
          {title} <span className={styles.count}>{count}</span>
        </h3>
        {onQuickCreate && <IconButton icon={<Plus size={iconSize.sm} />} label={`Crear en ${title}`} size="sm" onClick={onQuickCreate} />}
      </header>
      {progress && progressTotal > 0 && (
        <div className={styles.progressRow}>
          <div className={styles.progress} role="img" aria-label={progress.map((segment) => `${segment.label}: ${segment.count}`).join(", ")}>
            {progress
              .filter((segment) => segment.count > 0)
              .map((segment) => (
                <span key={segment.id} className={styles[segment.tone]} style={{ flexGrow: segment.count }} title={`${segment.label}: ${segment.count}`} />
              ))}
          </div>
          {total && <span className={styles.total}>{total}</span>}
        </div>
      )}
      <div className={styles.cards}>{children}</div>
    </section>
  );
}

type KanbanCardProps = { title: string; onOpen?: () => void; children?: ReactNode; footer?: ReactNode };

// El título es el botón que abre la tarjeta y se estira para cubrirla; el pie queda clicable encima.
export function KanbanCard({ title, onOpen, children, footer }: KanbanCardProps) {
  return (
    <article className={cx(styles.card, onOpen && styles.clickable)}>
      <h4 className={styles.cardTitle}>
        {onOpen ? (
          <button type="button" className={styles.open} onClick={onOpen}>
            {title}
          </button>
        ) : (
          title
        )}
      </h4>
      {children && <div className={styles.cardBody}>{children}</div>}
      {footer && <div className={styles.cardFooter}>{footer}</div>}
    </article>
  );
}
