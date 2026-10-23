"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeftRight, Inbox, Plus } from "lucide-react";
import { Button, DataTable, EmptyState, FormGroup, FormGroups, Pager, ReadonlyField, Sheet, SheetTitle, Spinner, iconSize, type Column } from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { FormPage, Notice } from "@/components/shell/FormPage";
import { fetchList } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import { formatAmount } from "@/lib/format-currency";
import { dayKey, formatDateOnly, formatTime } from "@/lib/agency-time";
import type { TreasuryDashboard, TreasuryMovementRow, TreasuryMovements } from "@/lib/resources/treasury";
import { BOX_TYPES, operationHref } from "./TreasuryBoard";
import { CashMovementDialog, TransferDialog } from "./TreasuryDialogs";
import styles from "./treasury.module.css";

const PAGE_SIZE = 50;
const movementDate = (value: string | Date) => `${formatDateOnly(`${dayKey(value)}T00:00:00Z`)} ${formatTime(value)}`;

// Movimientos de una caja, con el saldo que dejó cada uno.
export default function TreasuryBox({ id }: { id: string }) {
  const router = useRouter();
  const user = useShellUser();
  const [offset, setOffset] = useState(0);
  const [movementOpen, setMovementOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const page = useSWR<TreasuryMovements>(`/api/treasury/${id}/movements?offset=${offset}&limit=${PAGE_SIZE}`, fetchList, { keepPreviousData: true });
  // Las demás cajas solo hacen falta para el traspaso.
  const board = useSWR<TreasuryDashboard>(transferOpen ? "/api/treasury?days=2" : null, fetchList);

  if (page.error) {
    return (
      <EmptyState icon={<Inbox size={iconSize.lg} />} title="No se pudo abrir la caja" action={<Button onClick={() => router.push("/treasury")}>Volver a Tesorería</Button>}>
        {page.error.message}
      </EmptyState>
    );
  }
  if (!page.data) {
    return (
      <div aria-busy="true">
        <EmptyState icon={<Spinner label="Cargando la caja" size="lg" />} title="Cargando la caja" />
      </div>
    );
  }

  const { account } = page.data;
  const { code, decimals } = account.currency;
  const money = (value: number) => formatAmount(value, code, decimals);
  const writable = can(user, "treasury.write") && account.isActive && account.currency.isActive;
  const refresh = async () => {
    setOffset(0);
    await page.mutate();
  };

  const columns: Column<TreasuryMovementRow>[] = [
    { key: "date", label: "Fecha", width: "11rem", render: (row) => movementDate(row.date) },
    {
      key: "concept",
      label: "Concepto",
      render: (row) => (
        <span className={styles.concept}>
          <span>{row.concept}</span>
          {row.operation && (
            <Link className={styles.link} href={operationHref(row.operation)}>
              {row.operation.operationNumber}
            </Link>
          )}
          {row.observations && <span className={styles.muted}>{row.observations}</span>}
        </span>
      ),
    },
    { key: "income", label: "Entrada", align: "end", render: (row) => (row.type === "EXPENSE" ? "" : <span className={`${styles.amount} ${styles.positive}`}>{money(row.amount)}</span>) },
    { key: "expense", label: "Salida", align: "end", render: (row) => (row.type === "EXPENSE" ? <span className={`${styles.amount} ${styles.negative}`}>{money(row.amount)}</span> : "") },
    { key: "balance", label: "Saldo", align: "end", render: (row) => <span className={`${styles.amount} ${row.balance < 0 ? styles.negative : ""}`}>{money(row.balance)}</span> },
  ];

  const boxOption = { id: account.id, name: account.name, balance: account.balance, currency: account.currency };

  return (
    <FormPage
      breadcrumbs={[{ label: "Tesorería", href: "/treasury" }, { label: `${account.name} · ${code}` }]}
      header={null}
      actions={
        writable ? (
          <>
            <Button variant="primary" size="sm" icon={<Plus size={iconSize.sm} />} onClick={() => setMovementOpen(true)}>Movimiento</Button>
            <Button size="sm" icon={<ArrowLeftRight size={iconSize.sm} />} onClick={() => setTransferOpen(true)}>Traspaso</Button>
          </>
        ) : null
      }
      notice={!account.currency.isActive ? <Notice tone="warning">La moneda de esta caja está inactiva: se puede consultar pero no cargar movimientos.</Notice> : null}
    >
      <Sheet>
        <SheetTitle eyebrow={`${BOX_TYPES[account.type] ?? account.type} · ${code}`}>{account.name}</SheetTitle>
        <FormGroups>
          <FormGroup title="Saldo">
            <ReadonlyField label="Saldo actual">
              <span className={`${styles.bigBalance} ${account.balance < 0 ? styles.negative : ""}`}>{money(account.balance)}</span>
            </ReadonlyField>
          </FormGroup>
          <FormGroup title="Caja">
            <ReadonlyField label="Movimientos">{page.data.total}</ReadonlyField>
          </FormGroup>
        </FormGroups>

        <div className={styles.movementsHeader}>
          <h2 className={styles.sectionTitle}>Movimientos</h2>
          <Pager offset={offset} limit={PAGE_SIZE} total={page.data.total} onChange={setOffset} />
        </div>
        <div className={styles.tableBox}>
          <DataTable
            caption={`Movimientos de ${account.name}`}
            columns={columns}
            rows={page.data.movements}
            rowKey={(row) => row.id}
            empty={<EmptyState title="Todavía no hay movimientos">Aparecen al cobrar o pagar operaciones, o al cargar uno a mano.</EmptyState>}
          />
        </div>
      </Sheet>

      <CashMovementDialog box={movementOpen ? boxOption : null} onClose={() => setMovementOpen(false)} onSaved={refresh} />
      <TransferDialog open={transferOpen} from={account.id} boxes={board.data?.accounts ?? [boxOption]} onClose={() => setTransferOpen(false)} onSaved={refresh} />
    </FormPage>
  );
}
