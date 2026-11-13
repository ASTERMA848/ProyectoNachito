"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeftRight, Inbox, Plus, User } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FormGroup,
  FormGroups,
  Pager,
  ReadonlyField,
  Sheet,
  SheetTitle,
  SmartButton,
  SmartButtons,
  Spinner,
  iconSize,
  type Column,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { FormPage, Notice } from "@/components/shell/FormPage";
import { RecordPager } from "@/components/shell/RecordPager";
import { RecordHistory } from "@/components/shell/RecordHistory";
import { fetchList } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import { formatAmount } from "@/lib/format-currency";
import { formatTime, dayKey, formatDateOnly } from "@/lib/agency-time";
import type { AccountListItem, MovementItem, MovementsResult } from "@/lib/resources/accounts";
import { Balance, contactName } from "./balance";
import { MovementDialog } from "./MovementDialog";
import styles from "./accounts.module.css";

const PAGE_SIZE = 50;

// Fecha y hora de un movimiento en el horario de la agencia.
const movementDate = (value: string | Date) => `${formatDateOnly(`${dayKey(value)}T00:00:00Z`)} ${formatTime(value)}`;

// Estado de cuenta de un contacto en una moneda: saldo y movimientos, del más nuevo al más viejo.
export default function AccountDetail({ id }: { id: string }) {
  const router = useRouter();
  const user = useShellUser();
  const [offset, setOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const detail = useSWR<{ account: AccountListItem }>(`/api/accounts/${id}`, fetchList);
  const movements = useSWR<MovementsResult>(`/api/accounts/${id}/transactions?offset=${offset}&limit=${PAGE_SIZE}`, fetchList, { keepPreviousData: true });

  if (detail.error) {
    return (
      <EmptyState icon={<Inbox size={iconSize.lg} />} title="No se pudo abrir la cuenta" action={<Button onClick={() => router.push("/accounts")}>Volver a Cuentas corrientes</Button>}>
        {detail.error.message}
      </EmptyState>
    );
  }
  if (!detail.data) {
    return (
      <div aria-busy="true">
        <EmptyState icon={<Spinner label="Cargando la cuenta" size="lg" />} title="Cargando la cuenta" />
      </div>
    );
  }

  const { account } = detail.data;
  const { code, decimals } = account.currency;
  const name = contactName(account.contact);
  const canWrite = can(user, "accounts.write");
  const money = (value: number) => (value ? formatAmount(value, code, decimals) : "");

  const columns: Column<MovementItem>[] = [
    { key: "date", label: "Fecha", width: "11rem", render: (row) => movementDate(row.date) },
    {
      key: "concept",
      label: "Concepto",
      render: (row) => (
        <span className={styles.concept}>
          <span>{row.concept}</span>
          {row.operation && (
            <Link className={styles.link} href={`/operations/${row.operation.parentOperationId ?? row.operation.id}`} onClick={(event) => event.stopPropagation()}>
              {row.operation.operationNumber}
            </Link>
          )}
          {row.observations && <span className={styles.muted}>{row.observations}</span>}
        </span>
      ),
    },
    { key: "debit", label: "Debe", align: "end", render: (row) => <span className={`${styles.amount} ${styles.negative}`}>{money(row.debit)}</span> },
    { key: "credit", label: "Haber", align: "end", render: (row) => <span className={`${styles.amount} ${styles.positive}`}>{money(row.credit)}</span> },
    { key: "balance", label: "Saldo", align: "end", render: (row) => <Balance value={row.balance} code={code} decimals={decimals} /> },
  ];

  const situation = account.balance < 0 ? "El contacto le debe a la agencia" : account.balance > 0 ? "La agencia le debe al contacto" : "Cuenta saldada";

  return (
    <FormPage
      breadcrumbs={[{ label: "Cuentas corrientes", href: "/accounts" }, { label: `${name} · ${code}` }]}
      pager={<RecordPager resource="accounts" id={id} hrefOf={(next) => `/accounts/${next}`} label="Cuentas de la lista" />}
      header={null}
      aside={<RecordHistory entity="Account" id={id} refreshKey={account.balance} emptyText="Todavía no hay movimientos manuales." />}
      actions={canWrite ? <Button variant="primary" size="sm" icon={<Plus size={iconSize.sm} />} onClick={() => setDialogOpen(true)}>Movimiento</Button> : null}
      notice={!account.contact.isActive ? <Notice tone="warning">El contacto está archivado. Su cuenta se puede consultar y ajustar igual.</Notice> : null}
    >
      <Sheet>
        <SheetTitle
          eyebrow={`Cuenta corriente en ${code}`}
          aside={
            <SmartButtons>
              <SmartButton icon={<User size={iconSize.md} />} value="Ficha" label="Contacto" href={`/contacts/${account.contact.id}`} />
              <SmartButton icon={<ArrowLeftRight size={iconSize.md} />} value="Ver" label="Operaciones" href={`/operations?filter=contact:${account.contact.id}`} />
            </SmartButtons>
          }
        >
          {name}
        </SheetTitle>
        <FormGroups>
          <FormGroup title="Saldo">
            <ReadonlyField label="Saldo actual">
              <span className={styles.bigBalance}>
                <Balance value={account.balance} code={code} decimals={decimals} />
              </span>
            </ReadonlyField>
            <ReadonlyField label="Situación">{situation}</ReadonlyField>
          </FormGroup>
          <FormGroup title="Contacto">
            <ReadonlyField label="Documento">{account.contact.cuitCuil ?? account.contact.document ?? "—"}</ReadonlyField>
            <ReadonlyField label="Rol">{[account.contact.isClient && "Cliente", account.contact.isProvider && "Proveedor"].filter(Boolean).join(" y ") || "—"}</ReadonlyField>
          </FormGroup>
        </FormGroups>

        <div className={styles.movementsHeader}>
          <h2 className={styles.sectionTitle}>Movimientos</h2>
          {movements.data && <Pager offset={offset} limit={PAGE_SIZE} total={movements.data.total} onChange={setOffset} />}
        </div>
        <div className={styles.movements}>
          <DataTable
            caption={`Movimientos de ${name} en ${code}`}
            columns={columns}
            rows={movements.data?.transactions ?? []}
            rowKey={(row) => row.id}
            loading={!movements.data && !movements.error}
            empty={
              movements.error ? (
                <EmptyState title="No se pudieron cargar los movimientos" action={<Button onClick={() => movements.mutate()}>Reintentar</Button>} />
              ) : (
                <EmptyState title="Todavía no hay movimientos">Aparecen al completar operaciones o al cargar uno a mano.</EmptyState>
              )
            }
          />
        </div>
      </Sheet>

      <MovementDialog
        open={dialogOpen}
        fixed={{ contactId: account.contact.id, currencyId: account.currency.id, label: `${name} · ${code}`, symbol: account.currency.symbol || code }}
        onClose={() => setDialogOpen(false)}
        onSaved={async () => {
          setDialogOpen(false);
          setOffset(0);
          await Promise.all([detail.mutate(), movements.mutate()]);
        }}
      />
    </FormPage>
  );
}
