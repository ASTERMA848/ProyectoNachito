"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Download, Inbox, Settings as SettingsIcon } from "lucide-react";
import {
  Badge,
  Breadcrumbs,
  Button,
  ControlPanel,
  DataTable,
  Dialog,
  EmptyState,
  FilterPanel,
  Menu,
  Pager,
  SearchBar,
  iconSize,
  type BadgeTone,
  type Column,
  type SortState,
  type TableGroup,
} from "@/components/ui";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { buildFacets, buildPanel, facetRemoval, fetchList, toggleFilter, useListUrlState, type FilterGroup, type GroupOption, clearSearch, searchChange, toggleGroupBy, useGroupTree, subgroupKey } from "@/components/shell/list-state";
import { downloadCsv } from "@/lib/csv";
import { dayKey, formatDateOnly, formatTime } from "@/lib/agency-time";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-labels";
import type { AuditListResult, AuditRow } from "@/lib/resources/audit";
import styles from "./audit.module.css";

const PAGE_SIZE = 80;
const DEFAULT_SORT: SortState = { key: "created", dir: "desc" };
const GROUP_OPTIONS: GroupOption[] = [
  { id: "entity", label: "Registro" },
  { id: "action", label: "Acción" },
  { id: "user", label: "Usuario" },
];

const ACTION_TONES: Record<string, BadgeTone> = { CREATE: "success", DELETE: "danger", UPDATE: "info", UPDATE_STATE_OR_PAY: "info", SQL_QUERY: "warning" };

const when = (value: string | Date) => `${formatDateOnly(`${dayKey(value)}T00:00:00Z`)} ${formatTime(value)}`;
const entityLabel = (entity: string | null) => (entity ? AUDIT_ENTITIES[entity] ?? entity : "—");

// Registros con pantalla propia: el detalle ofrece abrirlos.
function recordHref(row: AuditRow) {
  if (!row.entityId || row.action === "DELETE") return null;
  if (row.entity === "Operation") return `/operations/${row.entityId}`;
  if (row.entity === "Contact") return `/contacts/${row.entityId}`;
  return null;
}

const summaryText = (row: AuditRow) =>
  row.summary.kind === "event" ? row.summary.text : row.summary.changes.map((change) => `${change.field}: ${change.from} → ${change.to}`).join("; ");

const pretty = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value, null, 2));

function AuditDetail({ row, onClose }: { row: AuditRow | null; onClose: () => void }) {
  const href = row && recordHref(row);
  return (
    <Dialog open={row !== null} onClose={onClose} size="lg" title={row ? `${AUDIT_ACTIONS[row.action] ?? row.action} · ${entityLabel(row.entity)}` : "Detalle"} footer={<Button onClick={onClose}>Cerrar</Button>}>
      {row && (
        <div className={styles.detail}>
          <dl className={styles.facts}>
            <div>
              <dt>Fecha</dt>
              <dd>{when(row.createdAt)}</dd>
            </div>
            <div>
              <dt>Usuario</dt>
              <dd>{row.user?.username ?? "Sistema"}</dd>
            </div>
            <div>
              <dt>Dirección IP</dt>
              <dd>{row.ipAddress ?? "—"}</dd>
            </div>
            <div>
              <dt>Registro</dt>
              <dd>
                {href ? (
                  <Link className={styles.link} href={href}>
                    Abrir {entityLabel(row.entity).toLowerCase()}
                  </Link>
                ) : (
                  <span className={styles.mono}>{row.entityId ?? "—"}</span>
                )}
              </dd>
            </div>
          </dl>

          {row.summary.kind === "change" ? (
            <table className={styles.changes}>
              <caption className="ui-sr-only">Campos modificados</caption>
              <thead>
                <tr>
                  <th scope="col">Campo</th>
                  <th scope="col">Antes</th>
                  <th scope="col">Después</th>
                </tr>
              </thead>
              <tbody>
                {row.summary.changes.map((change) => (
                  <tr key={change.field}>
                    <th scope="row">{change.field}</th>
                    <td>{change.from}</td>
                    <td>{change.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{row.summary.text}</p>
          )}

          {row.query && (
            <section>
              <h3 className={styles.blockTitle}>Consulta</h3>
              <pre className={styles.code}>{row.query}</pre>
            </section>
          )}
          {(row.before != null || row.after != null) && (
            <details className={styles.raw}>
              <summary>Valores guardados</summary>
              <div className={styles.rawGrid}>
                <section>
                  <h3 className={styles.blockTitle}>Antes</h3>
                  <pre className={styles.code}>{row.before != null ? pretty(row.before) : "—"}</pre>
                </section>
                <section>
                  <h3 className={styles.blockTitle}>Después</h3>
                  <pre className={styles.code}>{row.after != null ? pretty(row.after) : "—"}</pre>
                </section>
              </div>
            </details>
          )}
        </div>
      )}
    </Dialog>
  );
}

// Auditoría: quién hizo qué y cuándo, con los valores de antes y después. Solo lectura.
export default function AuditList() {
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
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const { data: userData } = useSWR<{ users: { id: string; username: string }[] }>("/api/audit?options=users", fetchList);
  const filterGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "date",
        label: "Fecha",
        options: [
          { id: "date:today", label: "Hoy" },
          { id: "date:last_7", label: "Últimos 7 días" },
          { id: "date:this_month", label: "Este mes" },
        ],
      },
      { id: "action", label: "Acción", collapsible: true, options: Object.entries(AUDIT_ACTIONS).map(([id, label]) => ({ id: `action:${id}`, label })) },
      { id: "entity", label: "Registro", collapsible: true, options: Object.entries(AUDIT_ENTITIES).map(([id, label]) => ({ id: `entity:${id}`, label })) },
      ...(userData?.users.length ? [{ id: "user", label: "Usuario", collapsible: true, options: userData.users.map((user) => ({ id: `user:${user.id}`, label: user.username })) }] : []),
    ],
    [userData],
  );

  const listUrl = useMemo(() => {
    const params = new URLSearchParams(baseQuery);
    if (groupBy) params.set("groupBy", groupBy);
    params.set("offset", String(groupBy ? 0 : offset));
    params.set("limit", String(PAGE_SIZE));
    return `/api/audit?${params}`;
  }, [baseQuery, groupBy, offset]);
  const { data, error, isLoading, mutate } = useSWR(listUrl, fetchList<AuditListResult>, { keepPreviousData: true });

  // Grupos y subgrupos que se abren a pedido (hasta dos niveles de agrupación).
  const tree = useGroupTree<AuditListResult["groups"] extends (infer G)[] | null ? G : never, AuditListResult["logs"][number]>({
    endpoint: "/api/audit",
    baseQuery,
    groupKeys: list.groupKeys,
    topGroups: data?.groups,
    open: openGroups,
    limit: PAGE_SIZE,
    readRows: (result) => (result as AuditListResult).logs,
    readGroups: (result) => (result as AuditListResult).groups,
  });

  const hasSearch = filters.length > 0 || terms.length > 0 || list.fieldTerms.length > 0;
  const facets = buildFacets(list, filterGroups, GROUP_OPTIONS);
  const panelSections = buildPanel(list, filterGroups, GROUP_OPTIONS, openPanelGroups);

  const rows = data?.logs ?? [];
  const visible = groupBy ? Object.values(tree.rows).flat() : rows;
  const selectedRows = visible.filter((row) => selected.has(row.id));

  const exportSelected = () => {
    downloadCsv(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Fecha", "Usuario", "Acción", "Registro", "Id del registro", "Detalle", "IP"],
      ...selectedRows.map((row) => [when(row.createdAt), row.user?.username ?? "Sistema", AUDIT_ACTIONS[row.action] ?? row.action, entityLabel(row.entity), row.entityId, summaryText(row), row.ipAddress]),
    ]);
    notify(`Se exportaron ${selectedRows.length} registros`, "success");
  };

  const columns: Column<AuditRow>[] = [
    { key: "created", label: "Fecha", sortable: true, width: "11rem", render: (row) => <span className={styles.nowrap}>{when(row.createdAt)}</span> },
    { key: "user", label: "Usuario", render: (row) => row.user?.username ?? "Sistema" },
    { key: "action", label: "Acción", render: (row) => <Badge tone={ACTION_TONES[row.action]}>{AUDIT_ACTIONS[row.action] ?? row.action}</Badge> },
    { key: "entity", label: "Registro", render: (row) => entityLabel(row.entity) },
    { key: "summary", label: "Detalle", render: (row) => <span className={styles.summary}>{summaryText(row)}</span> },
  ];

  const tableGroups: TableGroup<AuditRow>[] | undefined = data?.groups?.map((group) => ({
    key: group.key,
    label: group.label,
    count: group.count,
    expanded: openGroups.has(group.key),
    rows: tree.rows[group.key] ?? [],
    subgroups: list.groupKeys[1]
      ? (tree.subgroups[group.key] ?? []).map((child) => {
          const key = subgroupKey(group.key, child.key);
          return { key, label: child.label, count: child.count, expanded: openGroups.has(key), rows: tree.rows[key] ?? [] };
        })
      : undefined,
  }));

  const empty = hasSearch ? (
    <EmptyState icon={<Inbox size={iconSize.lg} />} title="Ningún registro coincide con la búsqueda" action={<Button onClick={() => update(clearSearch)}>Quitar filtros</Button>}>
      Probá con otro período, usuario o tipo de registro.
    </EmptyState>
  ) : (
    <EmptyState icon={<Inbox size={iconSize.lg} />} title="Todavía no hay actividad registrada">
      Cada alta, cambio, baja e inicio de sesión queda anotado acá.
    </EmptyState>
  );

  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            <Breadcrumbs items={[{ label: "Auditoría" }]} />
            {selected.size > 0 && (
              <>
                <span className={styles.selection}>{selected.size} seleccionados</span>
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
              const change = searchChange(list, query, null);
              if (change) update(change);
              setQuery("");
            }}
            onRemoveFacet={(id) => update(facetRemoval(id, list))}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((value) => !value)}
            label="Buscar en la auditoría"
            placeholder="Buscar usuario, número, valor o consulta..."
            panel={
              <FilterPanel
                sections={panelSections}
                onToggle={(sectionId, optionId) =>
                  sectionId === "groupBy" ? update(toggleGroupBy(list, optionId)) : update({ filter: toggleFilter(filters, optionId) })
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

      <div className={styles.listArea}>
        <DataTable
          caption="Registro de auditoría"
          columns={columns}
          rowKey={(row) => row.id}
          rowLabel={(row) => `${AUDIT_ACTIONS[row.action] ?? row.action} de ${row.user?.username ?? "Sistema"} el ${when(row.createdAt)}`}
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
          onRowOpen={setDetail}
          rowTone={(row) => (row.action === "DELETE" ? "danger" : undefined)}
          loading={isLoading && !data}
          empty={empty}
        />
      </div>

      <AuditDetail row={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
