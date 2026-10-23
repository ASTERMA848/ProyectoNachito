import { cx } from "./cx";
import { TAG_COLORS, tagStyle } from "./Tag";
import styles from "./Avatar.module.css";

// El color sale del nombre, así cada persona conserva el mismo en todas las pantallas.
function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const style = src ? { backgroundImage: `url(${JSON.stringify(src)})` } : tagStyle(colorFor(name));
  return (
    <span role="img" aria-label={name} className={cx(styles.avatar, styles[size], src && styles.photo)} style={style}>
      {!src && <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}
