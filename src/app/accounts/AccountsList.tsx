"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Download, Inbox, Plus, Settings as SettingsIcon } from "lucide-react";
import {
  Breadcrumbs,
  Button,
  ControlPanel,
  DataTable,
  EmptyState,
  FilterPanel,
  Menu,
  Pager,
  SearchBar,
  iconSize,
  type Column,
  type SortState,
  type TableGroup,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { buildFacets, buildPanel, facetRemoval, fetchList, toggleFilter, useListUrlState, type FilterGroup, type GroupOption } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import { downloadCsv } from "@/lib/csv";
import type { AccountListItem, AccountListResult } from "@/lib/resources/accounts";
import { Balance, contactName } from "./balance";
import { MovementDialog } from "./MovementDialog";
import styles from "./accounts.module.css";

const PAGE_SIZE = 80;
const DEFAULT_SORT: SortState = { key: "contact", dir: "asc" };
const GROUP_OPTIONS: GroupOption[] = [
  { id: "currency", label: "Moneda" },
  { id: "sign", label: "Situación" },
];

type CurrencyRow = { id: string; code: string; decimals: number };

export default function AccountsList() {
  const router = useRouter();
  const user = useShellUser();
  const { notify } = useUiFeedback();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const resetLocal = useCallback(() => {
    setSelected(new Set());
    setOpenGroups(new Set());
  }, []);
  const list = useListUrlState(DEFAULT_SORT, resetLocal);
  const { filters, terms, groupBy, sort, offset, update, baseQuery } = list;

  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [openPanelGroups, setOpenPanelGroups] = useState(new Set<string>());
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: currencyData } = useSWR<{ currencies: CurrencyRow[] }>("/api/currencies", fetchList);
  const filterGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "sign",
        label: "Situación",
        options: [
          { id: "sign:negative", label: "Deuda del contacto" },
          { id: "sign:positive", label: "A favor del contacto" },
          { id: "sign:zero", label: "Saldadas" },
        ],
      },
      { id: "role", label: "Rol", options: [{ id: "role:client", label: "Clientes" }, { id: "role:provider", label: "Proveedores" }] },
      ...(currencyData?.currencies.length
        ? [{ id: "currency", label: "Moneda", collapsible: true, options: currencyData.currencies.map((currency) => ({ id: `currency:${currency.id}`, label: currency.code })) }]
        : []),
    ],
    [currencyData],
  );

  const listUrl = useMemo(() => {
    const params = new URLSearchParams(baseQuery);
    if (groupBy) params.set("groupBy", groupBy);
    params.set("offset", String(groupBy ? 0 : offset));
    params.set("limit", String(PAGE_SIZE));
    return `/api/accounts?${params}`;
  }, [baseQuery, groupBy, offset]);
  const { data, error, isLoading, mutate } = useSWR(listUrl, fetchList<AccountListResult>, { keepPreviousData: true });

  const groupFilters = useMemo(() => (groupBy && data?.groups ? data.groups.filter((group) => openGroups.has(group.key)).map((group) => group.filter) : []), [groupBy, data, openGroups]);
  const { data: groupRows, mutate: mutateGroups } = useSWR(groupFilters.length ? ["account-groups", baseQuery, ...groupFilters] : null, async () => {
    const entries = await Promise.all(
      groupFilters.map(async (filter) => {
        const params = new URLSearchParams(baseQuery);
        params.append("filter", filter);
        params.set("limit", String(PAGE_SIZE));
        const result = await fetchList<AccountListResult>(`/api/accounts?${params}`);
        return [filter, result.accounts] as const;
      }),
    );
    return Object.fromEntries(entries);
  });

  const canWrite = can(user, "accounts.write");
  const hasSearch = filters.length > 0 || terms.length > 0;
  const facets = buildFacets(list, filterGroups, GROUP_OPTIONS);
  const panelSections = buildPanel(list, filterGroups, GROUP_OPTIONS, openPanelGroups);

  const rows = data?.accounts ?? [];
  const visible = groupBy ? Object.values(groupRows ?? {}).flat() : rows;
  const selectedAccounts = visible.filter((account) => selected.has(account.id));

  const exportSelected = () => {
    downloadCsv(`cuentas-corrientes-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Contacto", "Documento", "Moneda", "Saldo"],
      ...selectedAccounts.map((account) => [contactName(account.contact), account.contact.cuitCuil ?? account.contact.document, account.currency.code, account.balance.toFixed(account.currency.decimals)]),
    ]);
    notify(`Se exportaron ${selectedAccounts.length} cuentas`, "success");
  };

  const columns: Column<AccountListItem>[] = [
    { key: "contact", label: "Contacto", sortable: true, render: (account) => <span className={styles.strong}>{contactName(account.contact)}</span> },
    { key: "document", label: "Documento", render: (account) => account.contact.cuitCuil ?? account.contact.document ?? "—" },
    { key: "role", label: "Rol", render: (account) => [account.contact.isClient && "Cliente", account.contact.isProvider && "Proveedor"].filter(Boolean).join(" y ") || "—" },
    { key: "currency", label: "Moneda", sortable: true, render: (account) => account.currency.code },
    { key: "balance", label: "Saldo", align: "end", sortable: true, render: (account) => <Balance value={account.balance} code={account.currency.code} decimals={account.currency.decimals} /> },
  ];

  const tableGroups: TableGroup<AccountListItem>[] | undefined = data?.groups?.map((group) => {
    const sum = group.sums[0];
    const currency = sum && currencyData?.currencies.find((item) => item.id === sum.currencyId);
    return {
      key: group.key,
      label: group.label,
      count: group.count,
      expanded: openGroups.has(group.key),
      rows: groupRows?.[group.filter] ?? [],
      totals: sum ? { balance: <Balance value={sum.sum} code={sum.code} decimals={currency?.decimals ?? 2} /> } : undefined,
    };
  });

  const empty = hasSearch ? (
    <EmptyState icon={<Inbox size={iconSize.lg} />} title="Ninguna cuenta coincide con la búsqueda" action={<Button onClick={() => update({ filter: [], q: [] })}>Quitar filtros</Button>}>
      Probá con otro contacto o quitá algún filtro.
    </EmptyState>
  ) : (
    <EmptyState icon={<Inbox size={iconSize.lg} />} title="No hay saldos pendientes">
      Las cuentas se mueven al completar operaciones o al cargar un movimiento manual. Para ver las saldadas, filtrá por Saldadas.
    </EmptyState>
  );

  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            {canWrite && <Button variant="primary" icon={<Plus size={iconSize.sm} />} onClick={() => setDialogOpen(true)}>Movimiento</Button>}
            <Breadcrumbs items={[{ label: "Cuentas corrientes" }]} />
            {selected.size > 0 && (
              <>
                <span className={styles.selection}>{selected.size} seleccionadas</span>
                <Menu label="Acciones" icon={<SettingsIcon size={iconSize.sm} />} items={[{ id: "export", label: "Exportar a CSV", icon: <Download size={iconSize.sm} />, onSelect: exportSelected }]} />
              </>
            )}
          </>
        }
        search={
          <SearchBar
            facets={facets}
            query={query}
            onQueryChange={setQuery}
            onSubmit={() => {
              const text = query.trim();
              if (text && !terms.includes(text)) update({ q: [...terms, text] });
              setQuery("");
            }}
            onRemoveFacet={(id) => update(facetRemoval(id, list))}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((value) => !value)}
            label="Buscar cuentas corrientes"
            placeholder="Buscar contacto o documento..."
            panel={
              <FilterPanel
                sections={panelSections}
                onToggle={(sectionId, optionId) =>
                  sectionId === "groupBy" ? update({ groupBy: groupBy === optionId ? null : optionId }) : update({ filter: toggleFilter(filters, optionId) })
                }
                onExpand={(_section, id) =>
                  setOpenPanelGroups((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              />
            }
          />
        }
        end={!groupBy && data ? <Pager offset={offset} limit={PAGE_SIZE} total={data.total} onChange={(next) => update({ offset: next })} /> : undefined}
      />

      {error && (
        <div className={styles.alert} role="alert">
          <span>{error.message}</span>
          <Button size="sm" onClick={() => mutate()}>Reintentar</Button>
        </div>
      )}

      {data && data.totals.length > 0 && (
        <section className={styles.summary} aria-label="Totales por moneda">
          {data.totals.map((total) => (
            <div key={total.currencyId} className={styles.summaryItem}>
              <span className={styles.summaryCode}>{total.code}</span>
              <span className={styles.summaryLine}>
                <span className={styles.muted}>Deuda de contactos</span>
                <Balance value={total.negative} code={total.code} decimals={total.decimals} />
              </span>
              <span className={styles.summaryLine}>
                <span className={styles.muted}>A favor de contactos</span>
                <Balance value={total.positive} code={total.code} decimals={total.decimals} />
              </span>
            </div>
          ))}
        </section>
      )}

      <div className={styles.listArea}>
        <DataTable
          caption="Cuentas corrientes"
          columns={columns}
          rowKey={(account) => account.id}
          rowLabel={(account) => `${contactName(account.contact)} ${account.currency.code}`}
          rows={groupBy ? undefined : rows}
          groups={groupBy ? tableGroups : undefined}
          onToggleGroup={(key) =>
            setOpenGroups((current) => {
              const next = new Set(current);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          sort={sort}
          onSortChange={(next) => update({ sort: `${next.key}:${next.dir}` })}
          onRowOpen={(account) => router.push(`/accounts/${account.id}`)}
          loading={isLoading && !data}
          empty={empty}
        />
      </div>

      <MovementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={async () => {
          setDialogOpen(false);
          await Promise.all([mutate(), mutateGroups()]);
        }}
      />
    </div>
  );
}
