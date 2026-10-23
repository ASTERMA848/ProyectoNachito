import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./SmartButton.module.css";

type SmartButtonProps = { icon: ReactNode; value: ReactNode; label: string; onClick?: () => void; href?: string };

// Botón con contador arriba a la derecha del formulario ("12 Operaciones").
export function SmartButton({ icon, value, label, onClick, href }: SmartButtonProps) {
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <span className={styles.text}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={styles.button}>{content}</Link>
  ) : (
    <button type="button" className={styles.button} onClick={onClick}>
      {content}
    </button>
  );
}

export function SmartButtons({ children }: { children: ReactNode }) {
  return <div className={styles.box}>{children}</div>;
}
