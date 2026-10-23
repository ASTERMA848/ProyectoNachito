import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./Button";
import { iconSize } from "./tokens.generated";
import styles from "./Pager.module.css";

type PagerProps = { offset: number; limit: number; total: number; onChange: (offset: number) => void; label?: string };

// Con limit 1 muestra la posición del registro ("3 / 45"); si no, el rango ("1-80 / 230").
export function Pager({ offset, limit, total, onChange, label = "Paginación" }: PagerProps) {
  if (total === 0) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className={styles.pager} role="group" aria-label={label}>
      <span className={styles.value} aria-live="polite">
        {limit === 1 ? `${from} / ${total}` : `${from}-${to} / ${total}`}
      </span>
      <span className={styles.buttons}>
        <IconButton
          icon={<ChevronLeft size={iconSize.sm} />}
          label="Anterior"
          variant="secondary"
          size="sm"
          className={styles.previous}
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        />
        <IconButton
          icon={<ChevronRight size={iconSize.sm} />}
          label="Siguiente"
          variant="secondary"
          size="sm"
          className={styles.next}
          disabled={to >= total}
          onClick={() => onChange(offset + limit)}
        />
      </span>
    </div>
  );
}
