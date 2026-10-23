import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { iconSize } from "./tokens.generated";
import styles from "./Tag.module.css";

export const TAG_COLORS = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "indigo", "purple", "pink"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

// Las etiquetas guardan un color hexadecimal: se lleva al tono más cercano de la paleta.
export function tagColorFromHex(hex: string | null | undefined): TagColor {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!match) return "gray";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.12) return "gray";
  const delta = max - min;
  const hue = (max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
  const degrees = (hue + 360) % 360;
  const stops: [number, TagColor][] = [[15, "red"], [40, "orange"], [65, "yellow"], [160, "green"], [195, "teal"], [245, "blue"], [265, "indigo"], [300, "purple"], [345, "pink"], [360, "red"]];
  return stops.find(([limit]) => degrees < limit)?.[1] ?? "red";
}

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
