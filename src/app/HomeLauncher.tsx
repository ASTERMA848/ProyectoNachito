"use client";

import Link from "next/link";
import { Check } from "lucide-react";
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

type OnboardingState = {
  hasOperation: boolean;
  hasAccountMovement: boolean;
  hasTreasuryMovement: boolean;
  hasMainCurrency: boolean;
  hasTeam: boolean;
};

// Pasos para un usuario u operador nuevo: cada uno se tilda solo cuando la base
// confirma que ya pasó, nunca por un clic de "marcar como hecho".
const ONBOARDING_STEPS: { id: keyof OnboardingState; label: string; detail: string; href: string }[] = [
  { id: "hasMainCurrency", label: "Elegí la moneda principal", detail: "Define en qué moneda se informan los totales.", href: "/settings" },
  { id: "hasOperation", label: "Cargá tu primera operación", detail: "Una compra o venta registra el movimiento completo.", href: "/operations" },
  { id: "hasAccountMovement", label: "Revisá una cuenta corriente", detail: "Ahí queda el saldo de cada contacto.", href: "/accounts" },
  { id: "hasTreasuryMovement", label: "Registrá un movimiento de tesorería", detail: "Entradas y salidas de cada caja o cuenta.", href: "/treasury" },
  { id: "hasTeam", label: "Sumá a tu equipo", detail: "Cada usuario entra con su propio rol.", href: "/settings/users/new" },
];

// Pasos de referencia para AUDITOR: no crea datos, así que no hay nada que tildar.
const AUDITOR_STEPS: { label: string; detail: string; href: string }[] = [
  { label: "Revisá las operaciones", detail: "Podés ver el detalle de cada una, sin modificarlas.", href: "/operations" },
  { label: "Mirá la auditoría", detail: "Ahí queda cada cambio, quién lo hizo y cuándo.", href: "/audit" },
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

// Primeros pasos para ADMIN/OPERATOR: desaparece solo cuando ya están todos hechos,
// para no insistirle a una agencia que ya está en marcha.
function OnboardingChecklist() {
  const { data } = useSWR<OnboardingState>("/api/onboarding", fetchList);
  if (!data) return null;
  const pendingSteps = ONBOARDING_STEPS.filter((step) => !data[step.id]);
  if (pendingSteps.length === 0) return null;

  return (
    <section className={styles.onboarding} aria-labelledby="onboarding-title">
      <h2 id="onboarding-title" className={styles.sectionTitle}>Primeros pasos</h2>
      <ul className={styles.steps}>
        {ONBOARDING_STEPS.map((step) => {
          const done = data[step.id];
          return (
            <li key={step.id} className={styles.step}>
              <Link href={step.href} className={styles.stepLink} aria-current={done ? undefined : "step"}>
                <span className={done ? styles.stepCheckDone : styles.stepCheck} aria-hidden="true">
                  {done && <Check size={iconSize.sm} />}
                </span>
                <span className={styles.stepText}>
                  <span className={done ? styles.stepLabelDone : styles.stepLabel}>{step.label}</span>
                  <span className={styles.stepDetail}>{step.detail}</span>
                </span>
                <span className="ui-sr-only">{done ? ": hecho" : ": pendiente"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Primeros pasos para AUDITOR: solo lectura, sin datos propios que crear, así que sin marcas.
function AuditorGuide() {
  return (
    <section className={styles.onboarding} aria-labelledby="onboarding-title">
      <h2 id="onboarding-title" className={styles.sectionTitle}>Primeros pasos</h2>
      <ul className={styles.steps}>
        {AUDITOR_STEPS.map((step) => (
          <li key={step.href} className={styles.step}>
            <Link href={step.href} className={styles.stepLink}>
              <span className={styles.stepText}>
                <span className={styles.stepLabel}>{step.label}</span>
                <span className={styles.stepDetail}>{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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

        {user.role === "AUDITOR" ? <AuditorGuide /> : <OnboardingChecklist />}

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
