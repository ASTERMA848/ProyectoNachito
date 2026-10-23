"use client";

import Link from "next/link";
import useSWR from "swr";
import { useShellUser } from "@/components/shell/AppShell";
import { visibleApps } from "@/components/shell/apps";
import { fetchList } from "@/components/shell/list-state";
import { iconSize } from "@/components/ui";
import { AGENCY_TIME_ZONE } from "@/lib/agency-time";
import styles from "./home.module.css";

// Lo que conviene atender: cada cifra abre la lista de operaciones ya filtrada.
const PENDING = [
  { id: "pending", label: "Pendientes", filter: "state:pending" },
  { id: "collect", label: "Por cobrar", filter: "payment:client_pending" },
  { id: "pay", label: "Por pagar", filter: "payment:provider_pending" },
  { id: "today", label: "Con fecha de hoy", filter: "date:today" },
];

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hourCycle: "h23", timeZone: AGENCY_TIME_ZONE }).format(new Date()));
  return hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
};

function Counter({ label, filter }: { label: string; filter: string }) {
  const { data, error } = useSWR<{ total: number }>(`/api/operations?filter=${filter}&limit=1`, fetchList);
  return (
    <Link className={styles.counter} href={`/operations?filter=${filter}`}>
      <span className={styles.counterValue} aria-hidden={!data}>{error ? "—" : data ? data.total : "·"}</span>
      <span className={styles.counterLabel}>
        {label}
        {!data && !error && <span className="ui-sr-only">: cargando</span>}
      </span>
    </Link>
  );
}

// Inicio: un acceso por aplicación, como un escritorio, y las operaciones que esperan algo.
export default function HomeLauncher() {
  const user = useShellUser();
  const apps = visibleApps(user.role).filter((app) => app.id !== "home");

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            {greeting()}, {user.username}
          </h1>
        </header>

        <nav aria-label="Aplicaciones">
          <ul className={styles.grid}>
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <li key={app.id}>
                  <Link className={styles.app} href={app.href}>
                    <span className={styles.appIcon} aria-hidden="true">
                      <Icon size={iconSize.lg} />
                    </span>
                    <span className={styles.appLabel}>{app.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className={styles.pending} aria-labelledby="pending-title">
          <h2 id="pending-title" className={styles.sectionTitle}>Operaciones para atender</h2>
          <div className={styles.counters}>
            {PENDING.map((item) => (
              <Counter key={item.id} label={item.label} filter={item.filter} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
