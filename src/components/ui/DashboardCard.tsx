"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { Sparkline } from "./Sparkline";
import styles from "./DashboardCard.module.css";

type DashboardCardProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  balance: ReactNode;
  balanceTone?: "positive" | "negative";
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  menu?: ReactNode;
  lines?: { label: string; value: ReactNode }[];
  series?: number[];
  seriesLabel?: string;
};

// Tarjeta de una caja de tesorería: saldo, acciones y evolución del saldo.
export function DashboardCard({
  icon,
  title,
  subtitle,
  balance,
  balanceTone,
  primaryAction,
  secondaryAction,
  menu,
  lines = [],
  series,
  seriesLabel = "",
}: DashboardCardProps) {
  const titleId = useId();
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.head}>
        <span className={styles.icon} aria-hidden="true">{icon}</span>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {menu}
      </header>
      <div className={styles.body}>
        <dl className={styles.figures}>
          <div className={styles.balanceRow}>
            <dt className="ui-sr-only">Saldo</dt>
            <dd className={cx(styles.balance, balanceTone && styles[balanceTone])}>{balance}</dd>
          </div>
          {lines.map((line) => (
            <div key={line.label} className={styles.line}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
        {(primaryAction || secondaryAction) && (
          <div className={styles.actions}>
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </div>
      {series && <Sparkline values={series} label={seriesLabel} />}
    </article>
  );
}
