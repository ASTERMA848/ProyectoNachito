"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Download, Inbox, List, Plus, Settings as SettingsIcon, SquareKanban, Trash2 } from "lucide-react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  ControlPanel,
  DataTable,
  EmptyState,
  FilterPanel,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  Menu,
  Pager,
  SearchBar,
  Tag,
  ViewSwitcher,
  iconSize,
  type Column,
  type SortState,
  type TableGroup,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { buildFacets, buildPanel, facetRemoval, fetchList, toggleFilter, useListUrlState, type FilterGroup, type GroupOption } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import { formatAmount, formatMoney } from "@/lib/format-currency";
import { formatDateOnly } from "@/lib/agency-time";
import { downloadCsv } from "@/lib/csv";
import { OPERATION_STATE_TONES, OPERATION_STATES, OPERATION_TYPES } from "@/lib/operation-labels";
import type { CurrencySum } from "@/lib/list-query";
import type { OperationListResult } from "@/lib/resources/operations";
import { GROUP_ROW_LIMIT, useGroupRows } from "./useGroupRows";
import styles from "./operations.module.css";

type Op = OperationListResult["operations"][number];

const PAGE_SIZE = 80;
const DEFAULT_SORT: SortState = { key: "date", dir: "desc" };

const FILTER_GROUPS: FilterGroup[] = [
  {
    id: "state",
    label: "Estado",
    options: [
      { id: "state:pending", label: "Pendientes" },
      { id: "state:partial", label: "Parciales" },
      { id: "state:processing", label: "En proceso" },
      { id: "state:completed", label: "Completadas" },
      { id: "state:canceled", label: "Canceladas" },
    ],
  },
  {
    id: "payment",
    label: "Cobros y pagos",
    options: [
      { id: "payment:client_pending", label: "Cobro pendiente" },
      { id: "payment:provider_pending", label: "Pago al proveedor pendiente" },
    ],
  },
  {
    id: "type",
    label: "Tipo",
    options: [
      { id: "type:single", label: "Ventas 1 a 1" },
      { id: "type:distributed", label: "Ventas distribuidas" },
      { id: "type:standard", label: "Estándar" },
    ],
  },
  {
    id: "date",
    label: "Fecha de operación",
    collapsible: true,
    options: [
      { id: "date:today", label: "Hoy" },
      { id: "date:this_month", label: "Este mes" },
      { id: "date:last_month", label: "Mes pasado" },
      { id: "date:this_year", label: "Este año" },
    ],
  },
];

const GROUP_OPTIONS: GroupOption[] = [
  { id: "state", label: "Estado" },
  { id: "type", label: "Tipo" },
  { id: "originCurrency", label: "Moneda" },
  { id: "client", label: "Cliente" },
  { id: "provider", label: "Proveedor" },
  { id: "month", label: "Mes" },
];

const groupLabel = (id: string | null) => GROUP_OPTIONS.find((option) => option.id === id)?.label ?? id ?? "";
const joinSums = (sums: CurrencySum[]) => sums.map((sum) => formatAmount(sum.sum, sum.code)).join(" · ");
const contactName = (contact: { name: string; lastname?: string | null } | null | undefined) =>
  contact ? [contact.name, contact.lastname].filter(Boolean).join(" ") : "";

function clientLabel(op: Op) {
  if (op.client) return contactName(op.client);
  const clients = op.childOperations.length;
  return clients ? `${clients} ${clients === 1 ? "cliente" : "clientes"}` : "—";
}

export default function OperationsList() {
  const router = useRouter();
  const user = useShellUser();
  const { notify, confirm } = useUiFeedback();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  // Otra búsqueda cierra los grupos y limpia la selección.
  const resetLocal = useCallback(() => {
    setOpenGroups(new Set());
    setSelected(new Set());
  }, []);
  const list = useListUrlState(DEFAULT_SORT, resetLocal);
  const { filters, terms, groupBy, sort, offset, update, baseQuery } = list;

  // En teléfono la vista por defecto es kanban.
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => setIsPhone(window.matchMedia("(max-width: 767px)").matches), []);
  const view = list.view ?? (isPhone ? "kanban" : "list");
  const kanbanGroup = groupBy ?? "state";

  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [openPanelGroups, setOpenPanelGroups] = useState(new Set(["date"]));

  const activeGroup = view === "kanban" ? kanbanGroup : groupBy;
  const listUrl = useMemo(() => {
    const params = new URLSearchParams(baseQuery);
    if (activeGroup) params.set("groupBy", activeGroup);
    params.set("offset", String(activeGroup ? 0 : offset));
    params.set("limit", String(PAGE_SIZE));
    return `/api/operations?${params}`;
  }, [baseQuery, activeGroup, offset]);

  const { data, error, isLoading, mutate } = useSWR(listUrl, fetchList<OperationListResult>, { keepPreviousData: true });
  const groups = data?.groups ?? null;

  // En kanban todas las columnas cargan sus tarjetas; en lista, solo los grupos abiertos.
  const kanbanKeys = useMemo(() => new Set((view === "kanban" ? groups : [])?.map((group) => group.key) ?? []), [view, groups]);
  const { byKey, reload } = useGroupRows(baseQuery, groups, view === "kanban" ? kanbanKeys : openGroups);

  const canWrite = can(user, "operations.write");
  const canDelete = can(user, "operations.delete");
  const hasSearch = filters.length > 0 || terms.length > 0;

  const facets = buildFacets(list, FILTER_GROUPS, GROUP_OPTIONS);
  const panelSections = buildPanel(list, FILTER_GROUPS, GROUP_OPTIONS, openPanelGroups);
  const onPanelToggle = (sectionId: string, optionId: string) => {
    if (sectionId === "groupBy") return update({ groupBy: groupBy === optionId ? null : optionId });
    update({ filter: toggleFilter(filters, optionId) });
  };
  const onPanelExpand = (_sectionId: string, groupId: string) =>
    setOpenPanelGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  const visibleRows: Op[] = activeGroup ? Object.values(byKey).flatMap((group) => group.rows) : data?.operations ?? [];
  const selectedOps = visibleRows.filter((op) => selected.has(op.id));

  const exportSelected = () => {
    downloadCsv(`operaciones-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Número", "Fecha", "Tipo", "Cliente", "Proveedor", "Moneda", "Monto", "Total", "Moneda del total", "Estado"],
      ...selectedOps.map((op) => [
        op.operationNumber,
        formatDateOnly(op.operationDate),
        OPERATION_TYPES[op.type] ?? op.type,
        clientLabel(op),
        contactName(op.provider),
        op.originCurrency.code,
        formatMoney(op.originAmount, op.originCurrency.decimals),
        formatMoney(op.destAmount, op.destCurrency.decimals),
        op.destCurrency.code,
        OPERATION_STATES[op.state] ?? op.state,
      ]),
    ]);
    notify(`Se exportaron ${selectedOps.length} operaciones`, "success");
  };

  const deleteSelected = async () => {
    const accepted = await confirm(
      `Se eliminarán ${selectedOps.length} operaciones. Se revierten sus movimientos y se ajustan los saldos de cuentas corrientes y cajas. El historial se conserva.`,
      { title: "Eliminar operaciones", confirmLabel: "Eliminar", danger: true },
    );
    if (!accepted) return;
    let failed = 0;
    for (const op of selectedOps) {
      const response = await fetch(`/api/operations/${op.id}`, { method: "DELETE" }).catch(() => null);
      if (!response?.ok) failed += 1;
    }
    setSelected(new Set());
    reload();
    await mutate();
    if (failed) notify(`No se pudieron eliminar ${failed} operaciones`, "danger", "Revisá los permisos o probá de nuevo.");
    else notify("Operaciones eliminadas", "success", "Los saldos quedaron ajustados.");
  };

  const columns: Column<Op>[] = [
    { key: "number", label: "Número", sortable: true, render: (op) => <span className={styles.number}>{op.operationNumber}</span> },
    { key: "date", label: "Fecha", sortable: true, render: (op) => formatDateOnly(op.operationDate) },
    { key: "type", label: "Tipo", render: (op) => <span className={styles.muted}>{OPERATION_TYPES[op.type] ?? op.type}</span> },
    { key: "client", label: "Cliente", sortable: true, render: (op) => <span className={styles.truncate}>{clientLabel(op)}</span> },
    { key: "provider", label: "Proveedor", sortable: true, render: (op) => <span className={styles.truncate}>{contactName(op.provider) || "—"}</span> },
    { key: "origin", label: "Monto", align: "end", sortable: true, render: (op) => formatAmount(op.originAmount, op.originCurrency.code, op.originCurrency.decimals) },
    { key: "dest", label: "Total", align: "end", sortable: true, render: (op) => formatAmount(op.destAmount, op.destCurrency.code, op.destCurrency.decimals) },
    {
      key: "state",
      label: "Estado",
      sortable: true,
      render: (op) => <Badge tone={OPERATION_STATE_TONES[op.state] ?? "neutral"}>{OPERATION_STATES[op.state] ?? op.state}</Badge>,
    },
  ];

  const tableGroups: TableGroup<Op>[] | undefined = groups?.map((group) => ({
    key: group.key,
    label: group.label,
    count: group.count,
    expanded: openGroups.has(group.key),
    rows: byKey[group.key]?.rows ?? [],
    totals: { origin: joinSums(group.origin), dest: joinSums(group.dest) },
  }));

  const toggleGroup = (key: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const openOperation = (op: Op) => router.push(`/operations/${op.id}`);

  const newMenu = canWrite ? (
    <Menu
      label="Nueva operación"
      variant="primary"
      items={[
        { id: "single", label: "Venta 1 a 1", onSelect: () => router.push("/operations/new?type=single") },
        { id: "distributed", label: "Venta distribuida", onSelect: () => router.push("/operations/new?type=distributed") },
      ]}
    >
      Nuevo
    </Menu>
  ) : null;

  const empty = hasSearch ? (
    <EmptyState icon={<Inbox size={iconSize.lg} />} title="Ninguna operación coincide con la búsqueda" action={<Button onClick={() => update({ filter: [], q: [] })}>Quitar filtros</Button>}>
      Probá con otro texto o sacá alguno de los filtros.
    </EmptyState>
  ) : (
    <EmptyState
      icon={<Inbox size={iconSize.lg} />}
      title="Todavía no hay operaciones"
      action={canWrite ? <Button variant="primary" icon={<Plus size={iconSize.sm} />} onClick={() => router.push("/operations/new?type=single")}>Nueva venta</Button> : undefined}
    >
      Registrá la primera compra y venta de divisas para verla acá.
    </EmptyState>
  );

  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            {newMenu}
            <Breadcrumbs items={[{ label: "Operaciones" }]} />
            {selected.size > 0 && (
              <>
                <span className={styles.selection}>{selected.size} seleccionadas</span>
                <Menu
                  label="Acciones"
                  icon={<SettingsIcon size={iconSize.sm} />}
                  items={[
                    { id: "export", label: "Exportar a CSV", icon: <Download size={iconSize.sm} />, onSelect: exportSelected },
                    ...(canDelete
                      ? [
                          { type: "divider" as const, id: "divider" },
                          { id: "delete", label: "Eliminar", icon: <Trash2 size={iconSize.sm} />, danger: true, onSelect: deleteSelected },
                        ]
                      : []),
                  ]}
                />
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
            label="Buscar operaciones"
            placeholder="Buscar número, cliente o proveedor..."
            panel={<FilterPanel sections={panelSections} onToggle={onPanelToggle} onExpand={onPanelExpand} />}
          />
        }
        end={
          <>
            {!activeGroup && data && <Pager offset={offset} limit={PAGE_SIZE} total={data.total} onChange={(next) => update({ offset: next })} />}
            <ViewSwitcher
              value={view}
              onChange={(next) => update({ view: next })}
              views={[
                { id: "list", label: "Lista", icon: <List size={iconSize.sm} /> },
                { id: "kanban", label: "Kanban", icon: <SquareKanban size={iconSize.sm} /> },
              ]}
            />
          </>
        }
      />

      {error && (
        <div className={styles.alert} role="alert">
          <span>{error.message}</span>
          <Button size="sm" onClick={() => mutate()}>Reintentar</Button>
        </div>
      )}

      {view === "list" ? (
        <div className={styles.listArea}>
          <DataTable
            caption="Operaciones"
            columns={columns}
            rowKey={(op) => op.id}
            rowLabel={(op) => op.operationNumber}
            rows={activeGroup ? undefined : data?.operations}
            groups={activeGroup ? tableGroups : undefined}
            onToggleGroup={toggleGroup}
            selectable
            selected={selected}
            onSelectionChange={setSelected}
            sort={sort}
            onSortChange={(next) => update({ sort: `${next.key}:${next.dir}` })}
            onRowOpen={openOperation}
            rowTone={(op) => (op.state === "CANCELED" ? "muted" : undefined)}
            totals={data && data.total > 0 ? { origin: joinSums(data.totals.origin), dest: joinSums(data.totals.dest) } : undefined}
            loading={isLoading && !data}
            empty={empty}
          />
        </div>
      ) : data && data.total === 0 ? (
        <div className={styles.listArea}>{empty}</div>
      ) : (
        <KanbanBoard label={`Operaciones por ${groupLabel(kanbanGroup).toLowerCase()}`}>
          {(groups ?? []).map((group) => {
            const cards = byKey[group.key]?.rows ?? [];
            const paid = cards.filter((op) => op.isPaid).length;
            return (
              <KanbanColumn
                key={group.key}
                title={group.label}
                count={group.count}
                total={joinSums(group.dest)}
                progress={[
                  { id: "paid", tone: "success", count: paid, label: "Cobradas" },
                  { id: "unpaid", tone: "warning", count: cards.length - paid, label: "Por cobrar" },
                ]}
              >
                {cards.map((op) => (
                  <KanbanCard
                    key={op.id}
                    title={op.operationNumber}
                    onOpen={() => openOperation(op)}
                    footer={
                      <>
                        <Tag color={op.type === "DISTRIBUTED_SALE" ? "indigo" : op.type === "SINGLE_SALE" ? "blue" : "gray"}>
                          {OPERATION_TYPES[op.type] ?? op.type}
                        </Tag>
                        {op.client && <Avatar name={contactName(op.client)} size="sm" />}
                      </>
                    }
                  >
                    <span>
                      {formatAmount(op.originAmount, op.originCurrency.code, op.originCurrency.decimals)} →{" "}
                      {formatAmount(op.destAmount, op.destCurrency.code, op.destCurrency.decimals)}
                    </span>
                    <span className={styles.muted}>{clientLabel(op)}</span>
                  </KanbanCard>
                ))}
                {group.count > cards.length && byKey[group.key]?.status === "done" && (
                  <p className={styles.more}>
                    Se muestran {Math.min(cards.length, GROUP_ROW_LIMIT)} de {group.count}. Filtrá para ver el resto.
                  </p>
                )}
              </KanbanColumn>
            );
          })}
        </KanbanBoard>
      )}
    </div>
  );
}
