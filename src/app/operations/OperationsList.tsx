"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Download, Filter, Inbox, Layers, List, Plus, Settings as SettingsIcon, SquareKanban, Trash2 } from "lucide-react";
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
  type Facet,
  type PanelSection,
  type SortState,
  type TableGroup,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useUiFeedback } from "@/components/shell/UiFeedback";
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

// Filtros del panel: los del mismo grupo se combinan con O.
const FILTER_GROUPS: { id: string; label: string; options: { id: string; label: string }[] }[] = [
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
    label: "Fecha",
    options: [
      { id: "date:today", label: "Hoy" },
      { id: "date:this_month", label: "Este mes" },
      { id: "date:last_month", label: "Mes pasado" },
      { id: "date:this_year", label: "Este año" },
    ],
  },
];

const GROUP_OPTIONS = [
  { id: "state", label: "Estado" },
  { id: "type", label: "Tipo" },
  { id: "originCurrency", label: "Moneda" },
  { id: "client", label: "Cliente" },
  { id: "provider", label: "Proveedor" },
  { id: "month", label: "Mes" },
];

const FILTER_LABELS = new Map(FILTER_GROUPS.flatMap((group) => group.options.map((option) => [option.id, option.label] as const)));
const groupLabel = (id: string | null) => GROUP_OPTIONS.find((option) => option.id === id)?.label ?? id ?? "";

const joinSums = (sums: CurrencySum[]) => sums.map((sum) => formatAmount(sum.sum, sum.code)).join(" · ");

const contactName = (contact: { name: string } | null | undefined) => contact?.name ?? "";

function clientLabel(op: Op) {
  if (op.client) return contactName(op.client);
  const clients = op.childOperations.length;
  return clients ? `${clients} ${clients === 1 ? "cliente" : "clientes"}` : "—";
}

const fetcher = async (url: string): Promise<OperationListResult> => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudieron cargar las operaciones");
  return data;
};

export default function OperationsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useShellUser();
  const { notify, confirm } = useUiFeedback();

  // La URL es la fuente de verdad: filtros, búsqueda, agrupación, orden, página y vista.
  const filters = searchParams.getAll("filter");
  const terms = searchParams.getAll("q");
  const groupBy = searchParams.get("groupBy");
  const [sortKey, sortDir] = (searchParams.get("sort") ?? "").split(":");
  const sort: SortState = sortKey ? { key: sortKey, dir: sortDir === "asc" ? "asc" : "desc" } : DEFAULT_SORT;
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  // En teléfono la vista por defecto es kanban.
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => setIsPhone(window.matchMedia("(max-width: 767px)").matches), []);
  const view = searchParams.get("view") ?? (isPhone ? "kanban" : "list");
  const kanbanGroup = groupBy ?? "state";

  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const update = (changes: { filter?: string[]; q?: string[]; groupBy?: string | null; sort?: string | null; offset?: number; view?: string }) => {
    const next = new URLSearchParams(searchParams.toString());
    const setList = (key: string, values: string[]) => {
      next.delete(key);
      values.forEach((value) => next.append(key, value));
    };
    const setOne = (key: string, value: string | null | undefined) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    if (changes.filter) setList("filter", changes.filter);
    if (changes.q) setList("q", changes.q);
    if (changes.groupBy !== undefined) setOne("groupBy", changes.groupBy);
    if (changes.sort !== undefined) setOne("sort", changes.sort);
    if (changes.view) next.set("view", changes.view);
    // Cambiar qué se busca vuelve a la primera página y cierra los grupos.
    const searchChanged = changes.filter || changes.q || changes.groupBy !== undefined || changes.sort !== undefined;
    if (searchChanged) {
      next.delete("offset");
      setOpenGroups(new Set());
      setSelected(new Set());
    }
    if (changes.offset !== undefined) setOne("offset", changes.offset ? String(changes.offset) : null);
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  // Lo que se busca, sin página ni agrupación: base de las filas de cada grupo.
  const baseQuery = useMemo(() => {
    const params = new URLSearchParams();
    terms.forEach((term) => params.append("q", term));
    filters.forEach((filter) => params.append("filter", filter));
    params.set("sort", `${sort.key}:${sort.dir}`);
    return params.toString();
  }, [terms, filters, sort.key, sort.dir]);

  const activeGroup = view === "kanban" ? kanbanGroup : groupBy;
  const listUrl = useMemo(() => {
    const params = new URLSearchParams(baseQuery);
    if (activeGroup) params.set("groupBy", activeGroup);
    params.set("offset", String(activeGroup ? 0 : offset));
    params.set("limit", String(PAGE_SIZE));
    return `/api/operations?${params}`;
  }, [baseQuery, activeGroup, offset]);

  const { data, error, isLoading, mutate } = useSWR(listUrl, fetcher, { keepPreviousData: true });
  const groups = data?.groups ?? null;

  // En kanban todas las columnas cargan sus tarjetas; en lista, solo los grupos abiertos.
  const kanbanKeys = useMemo(() => new Set((view === "kanban" ? groups : [])?.map((group) => group.key) ?? []), [view, groups]);
  const { byKey, reload } = useGroupRows(baseQuery, groups, view === "kanban" ? kanbanKeys : openGroups);

  const canWrite = can(user, "operations.write");
  const canDelete = can(user, "operations.delete");
  const hasSearch = filters.length > 0 || terms.length > 0;

  const facets: Facet[] = [
    ...terms.map((term) => ({ id: `q:${term}`, kind: "field" as const, values: [term] })),
    ...FILTER_GROUPS.filter((group) => filters.some((filter) => filter.startsWith(`${group.id}:`))).map((group) => ({
      id: `filter:${group.id}`,
      kind: "filter" as const,
      values: filters.filter((filter) => filter.startsWith(`${group.id}:`)).map((filter) => FILTER_LABELS.get(filter) ?? filter),
    })),
    ...(groupBy ? [{ id: "groupBy", kind: "group" as const, values: [groupLabel(groupBy)] }] : []),
  ];

  const removeFacet = (id: string) => {
    if (id === "groupBy") return update({ groupBy: null });
    if (id.startsWith("q:")) return update({ q: terms.filter((term) => `q:${term}` !== id) });
    const group = id.replace("filter:", "");
    update({ filter: filters.filter((filter) => !filter.startsWith(`${group}:`)) });
  };

  const toggleFilter = (id: string) => update({ filter: filters.includes(id) ? filters.filter((filter) => filter !== id) : [...filters, id] });

  const panelSections: PanelSection[] = [
    {
      id: "filters",
      title: "Filtros",
      icon: <Filter size={iconSize.sm} />,
      iconTone: "accent",
      groups: FILTER_GROUPS.map((group) =>
        group.id === "date"
          ? [{ id: "date", label: "Fecha de operación", expanded: dateOpen, options: group.options.map((option) => ({ ...option, active: filters.includes(option.id) })) }]
          : group.options.map((option) => ({ ...option, active: filters.includes(option.id) })),
      ),
    },
    {
      id: "groupBy",
      title: "Agrupar por",
      icon: <Layers size={iconSize.sm} />,
      iconTone: "action",
      groups: [GROUP_OPTIONS.map((option) => ({ ...option, active: groupBy === option.id }))],
    },
  ];

  const onPanelToggle = (sectionId: string, optionId: string) => {
    if (sectionId === "groupBy") return update({ groupBy: groupBy === optionId ? null : optionId });
    toggleFilter(optionId);
  };

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
            onRemoveFacet={removeFacet}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((value) => !value)}
            label="Buscar operaciones"
            placeholder="Buscar número, cliente o proveedor..."
            panel={<FilterPanel sections={panelSections} onToggle={onPanelToggle} onExpand={() => setDateOpen((value) => !value)} />}
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
