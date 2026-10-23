"use client";

import { useId, type ReactNode } from "react";
import styles from "./Settings.module.css";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>{title}</h2>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

type SettingProps = { title: string; description?: ReactNode; control?: ReactNode; htmlFor?: string; children?: ReactNode };

// Control a la izquierda (casilla o interruptor); el título es su etiqueta.
export function Setting({ title, description, control, htmlFor, children }: SettingProps) {
  const Title = htmlFor ? "label" : "p";
  return (
    <div className={styles.setting}>
      <div className={styles.control}>{control}</div>
      <div className={styles.content}>
        <Title htmlFor={htmlFor} className={styles.settingTitle}>{title}</Title>
        {description && <p className={styles.description}>{description}</p>}
        {children && <div className={styles.extra}>{children}</div>}
      </div>
    </div>
  );
}
