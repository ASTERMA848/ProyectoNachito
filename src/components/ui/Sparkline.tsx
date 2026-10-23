import styles from "./Sparkline.module.css";

const HEIGHT = 32;

// Línea de evolución en un viewBox de 100 x 32; se estira al ancho del contenedor.
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const points = values
    .map((value, index) => `${((index / (values.length - 1)) * 100).toFixed(2)},${(HEIGHT - 2 - ((value - min) / span) * (HEIGHT - 4)).toFixed(2)}`)
    .join(" ");
  return (
    <svg className={styles.spark} viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polygon points={`0,${HEIGHT} ${points} 100,${HEIGHT}`} className={styles.area} />
      <polyline points={points} className={styles.line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
