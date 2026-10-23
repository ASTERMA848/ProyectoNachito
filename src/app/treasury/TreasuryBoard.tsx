"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeftRight, Banknote, Inbox, Landmark, List, MoreVertical, Plus, Wallet } from "lucide-react";
import { Breadcrumbs, Button, ControlPanel, DashboardCard, DataTable, EmptyState, Menu, Spinner, iconSize, type Column } from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { fetchList } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import { formatAmount } from "@/lib/format-currency";
import { dayKey, dayLabel, formatTime } from "@/lib/agency-time";
import type { RecentMovement, TreasuryDashboard } from "@/lib/resources/treasury";
import { CashMovementDialog, TransferDialog, type BoxOption } from "./TreasuryDialogs";
import styles from "./treasury.module.css";

const DAYS = 30;

export const BOX_TYPES: Record<string, string> = { CASH: "Efectivo", BANK: "Banco", WALLET: "Billetera" };
const BOX_ICONS: Record<string, typeof Banknote> = { CASH: Banknote, BANK: Landmark, WALLET: Wallet };

export const operationHref = (operation: { id: string; parentOperationId: string | null }) => `/operations/${operation.parentOperationId ?? operation.id}`;

// Tablero de tesorería: una tarjeta por caja y los últimos movimientos de todas.
export default function TreasuryBoard() {
  const router = useRouter();
  const user = useShellUser();
  const { data, error, mutate } = useSWR<TreasuryDashboard>(`/api/treasury?days=${DAYS}`, fetchList);
  const [movementBox, setMovementBox] = useState<BoxOption | null>(null);
  const [transfer, setTransfer] = useState<{ from?: string } | null>(null);

  const canWrite = can(user, "treasury.write");
  const boxes = data?.accounts ?? [];

  const recentColumns: Column<RecentMovement>[] = [
    { key: "date", label: "Fecha", width: "10rem", render: (row) => `${dayLabel(dayKey(row.date))} ${formatTime(row.date)}` },
    { key: "box", label: "Caja", render: (row) => `${row.account.name} · ${row.account.currency.code}` },
    {
      key: "concept",
      label: "Concepto",
      render: (row) => (
        <span className={styles.concept}>
          <span className={styles.truncate}>{row.concept}</span>
          {row.operation && (
            <Link className={styles.link} href={operationHref(row.operation)} onClick={(event) => event.stopPropagation()}>
              {row.operation.operationNumber}
            </Link>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Importe",
      align: "end",
      render: (row) => (
        <span className={`${styles.amount} ${row.type === "EXPENSE" ? styles.negative : styles.positive}`}>
          {formatAmount(row.type === "EXPENSE" ? -row.amount : row.amount, row.account.currency.code, row.account.currency.decimals)}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            {canWrite && boxes.length > 1 && (
              <Button variant="primary" icon={<ArrowLeftRight size={iconSize.sm} />} onClick={() => setTransfer({})}>Traspaso</Button>
            )}
            <Breadcrumbs items={[{ label: "Tesorería" }]} />
          </>
        }
      />

      {error ? (
        <EmptyState icon={<Inbox size={iconSize.lg} />} title="No se pudo cargar tesorería" action={<Button onClick={() => mutate()}>Reintentar</Button>}>
          {error.message}
        </EmptyState>
      ) : !data ? (
        <div aria-busy="true">
          <EmptyState icon={<Spinner label="Cargando las cajas" size="lg" />} title="Cargando las cajas" />
        </div>
      ) : (
        <div className={styles.board}>
          <section aria-label="Cajas" className={styles.cards}>
            {boxes.map((box) => {
              const Icon = BOX_ICONS[box.type] ?? Banknote;
              const money = (value: number) => formatAmount(value, box.currency.code, box.currency.decimals);
              const inactive = !box.currency.isActive;
              return (
                <DashboardCard
                  key={box.id}
                  icon={<Icon size={iconSize.md} />}
                  title={box.name}
                  subtitle={`${BOX_TYPES[box.type] ?? box.type} · ${box.currency.code}${inactive ? " · moneda inactiva" : ""}`}
                  balance={money(box.balance)}
                  balanceTone={box.balance < 0 ? "negative" : undefined}
                  lines={[
                    { label: "Entró hoy", value: money(box.today.income) },
                    { label: "Salió hoy", value: money(box.today.expense) },
                  ]}
                  series={box.series}
                  seriesLabel={`Saldo de ${box.name} en los últimos ${DAYS} días: de ${money(box.series[0])} a ${money(box.balance)}`}
                  primaryAction={
                    canWrite && !inactive ? (
                      <Button variant="primary" size="sm" icon={<Plus size={iconSize.sm} />} onClick={() => setMovementBox(box)}>Movimiento</Button>
                    ) : undefined
                  }
                  secondaryAction={<Button size="sm" icon={<List size={iconSize.sm} />} onClick={() => router.push(`/treasury/${box.id}`)}>Ver movimientos</Button>}
                  menu={
                    canWrite && !inactive && boxes.length > 1 ? (
                      <Menu
                        label={`Más acciones de ${box.name}`}
                        icon={<MoreVertical size={iconSize.sm} />}
                        align="end"
                        items={[{ id: "transfer", label: "Traspasar a otra caja", icon: <ArrowLeftRight size={iconSize.sm} />, onSelect: () => setTransfer({ from: box.id }) }]}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </section>

          <section className={styles.recent} aria-labelledby="recent-title">
            <h2 id="recent-title" className={styles.sectionTitle}>Últimos movimientos</h2>
            <div className={styles.tableBox}>
              <DataTable
                caption="Últimos movimientos de todas las cajas"
                columns={recentColumns}
                rows={data.recent}
                rowKey={(row) => row.id}
                onRowOpen={(row) => router.push(`/treasury/${row.account.id}`)}
                empty={<EmptyState title="Todavía no hay movimientos">Aparecen al cobrar o pagar operaciones, o al cargar uno a mano.</EmptyState>}
              />
            </div>
          </section>
        </div>
      )}

      <CashMovementDialog box={movementBox} onClose={() => setMovementBox(null)} onSaved={() => mutate()} />
      <TransferDialog open={transfer !== null} from={transfer?.from} boxes={boxes} onClose={() => setTransfer(null)} onSaved={() => mutate()} />
    </div>
  );
}
