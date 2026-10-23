import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { iconSize } from "./tokens.generated";
import styles from "./Tag.module.css";

export const TAG_COLORS = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "indigo", "purple", "pink"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export const tagStyle = (color: TagColor): CSSProperties => ({
  background: `var(--ui-tag-${color}-bg)`,
  color: `var(--ui-tag-${color}-text)`,
});

export function Tag({ color = "gray", children, onRemove }: { color?: TagColor; children: string; onRemove?: () => void }) {
  return (
    <span className={styles.tag} style={tagStyle(color)}>
      {children}
      {onRemove && (
        <button type="button" className={styles.remove} onClick={onRemove} aria-label={`Quitar etiqueta ${children}`}>
          <X size={iconSize.xs} />
        </button>
      )}
    </span>
  );
}
