"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Inbox, PauseCircle, PlayCircle, Settings as SettingsIcon } from "lucide-react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  ControlPanel,
  DataTable,
  EmptyState,
  FilterPanel,
  Menu,
  SearchBar,
  iconSize,
  type Column,
  type SortState,
  type TableGroup,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { rememberRecordList } from "@/components/shell/RecordPager";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { buildFacets, buildPanel, facetRemoval, fetchList, toggleFilter, useListUrlState, type FilterGroup, type GroupOption, clearSearch, searchChange } from "@/components/shell/list-state";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { dayKey, formatDateOnly } from "@/lib/agency-time";
import styles from "../settings.module.css";

export type UserRow = { id: string; username: string; role: string; isActive: boolean; createdAt: string };

const DEFAULT_SORT: SortState = { key: "username", dir: "asc" };
const GROUP_OPTIONS: GroupOption[] = [{ id: "role", label: "Rol" }];
const ROLES = ["ADMIN", "OPERATOR", "AUDITOR"];

const FILTER_GROUPS: FilterGroup[] = [
  { id: "role", label: "Rol", options: ROLES.map((role) => ({ id: `role:${role}`, label: ROLE_LABELS[role] })) },
  { id: "status", label: "Estado", options: [{ id: "status:paused", label: "Pausados" }] },
];

// Los usuarios son pocos: se traen todos y los filtros de la URL se aplican acá, con las mismas reglas
// que las demás listas (O dentro de un grupo, Y entre grupos; los pausados solo si se piden).
function applyFilters(users: UserRow[], filters: string[], terms: string[]) {
  const byGroup = new Map<string, string[]>();
  for (const filter of filters) {
    const [group, value] = filter.split(":");
    byGroup.set(group, [...(byGroup.get(group) ?? []), value]);
  }
  return users.filter((user) => {
    const roles = byGroup.get("role");
    if (roles && !roles.includes(user.role)) return false;
    if (byGroup.has("status") ? user.isActive : !user.isActive) return false;
    return !terms.length || terms.some((term) => user.username.toLowerCase().includes(term.toLowerCase()));
  });
}

export default function UsersList() {
  const router = useRouter();
  const me = useShellUser();
  const { notify, confirm } = useUiFeedback();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const resetLocal = useCallback(() => {
    setSelected(new Set());
    setOpenGroups(new Set());
  }, []);
  const list = useListUrlState(DEFAULT_SORT, resetLocal);
  const { filters, terms, groupBy, sort, update } = list;
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{ users: UserRow[] }>("/api/users", fetchList);
  const canWrite = can(me, "settings.write");

  const rows = useMemo(() => {
    const filtered = applyFilters(data?.users ?? [], filters, terms);
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => factor * (sort.key === "created" ? a.createdAt.localeCompare(b.createdAt) : a.username.localeCompare(b.username)));
  }, [data, filters, terms, sort]);

  const facets = buildFacets(list, FILTER_GROUPS, GROUP_OPTIONS);
  const panelSections = buildPanel(list, FILTER_GROUPS, GROUP_OPTIONS, new Set());
  const selectedUsers = rows.filter((user) => selected.has(user.id));

  const setActive = async (isActive: boolean) => {
    const targets = selectedUsers.filter((user) => user.isActive !== isActive && user.id !== me.id);
    if (!targets.length) return notify(isActive ? "Los seleccionados ya están activos" : "No hay usuarios para pausar (no podés pausarte a vos)", "warning");
    if (!isActive) {
      const accepted = await confirm(`Se pausarán ${targets.length} usuarios. No van a poder entrar y se cierran sus sesiones abiertas.`, { title: "Pausar usuarios", confirmLabel: "Pausar" });
      if (!accepted) return;
    }
    const results = await Promise.all(
      targets.map((user) =>
        fetch(`/api/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).then((response) => response.ok, () => false),
      ),
    );
    const failed = results.filter((ok) => !ok).length;
    setSelected(new Set());
    await mutate();
    if (failed) notify(`No se pudieron actualizar ${failed} usuarios`, "danger");
    else notify(isActive ? "Usuarios reactivados" : "Usuarios pausados", "success");
  };

  const columns: Column<UserRow>[] = [
    {
      key: "username",
      label: "Usuario",
      sortable: true,
      render: (user) => (
        <span className={styles.nameCell}>
          <Avatar name={user.username} size="sm" />
          <span>{user.username}</span>
          {user.id === me.id && <Badge>Vos</Badge>}
        </span>
      ),
    },
    { key: "role", label: "Rol", render: (user) => ROLE_LABELS[user.role] ?? user.role },
    { key: "status", label: "Estado", render: (user) => (user.isActive ? <Badge tone="success">Activo</Badge> : <Badge>Pausado</Badge>) },
    { key: "created", label: "Alta", sortable: true, render: (user) => formatDateOnly(`${dayKey(user.createdAt)}T00:00:00Z`) },
  ];

  const tableGroups: TableGroup<UserRow>[] | undefined =
    groupBy === "role"
      ? ROLES.map((role) => ({ role, rows: rows.filter((user) => user.role === role) }))
          .filter((group) => group.rows.length)
          .map((group) => ({ key: group.role, label: ROLE_LABELS[group.role], count: group.rows.length, expanded: openGroups.has(group.role), rows: group.rows }))
      : undefined;

  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            {canWrite && <Button variant="primary" onClick={() => router.push("/settings/users/new")}>Nuevo</Button>}
            <Breadcrumbs items={[{ label: "Configuración", href: "/settings" }, { label: "Usuarios" }]} />
            {selected.size > 0 && canWrite && (
              <>
                <span className={styles.selection}>{selected.size} seleccionados</span>
                <Menu
                  label="Acciones"
                  icon={<SettingsIcon size={iconSize.sm} />}
                  items={[
                    { id: "pause", label: "Pausar", icon: <PauseCircle size={iconSize.sm} />, onSelect: () => void setActive(false) },
                    { id: "resume", label: "Reactivar", icon: <PlayCircle size={iconSize.sm} />, onSelect: () => void setActive(true) },
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
              const change = searchChange(list, query, null);
              if (change) update(change);
              setQuery("");
            }}
            onRemoveFacet={(id) => update(facetRemoval(id, list))}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((value) => !value)}
            label="Buscar usuarios"
            placeholder="Buscar usuario..."
            panel={
              <FilterPanel
                sections={panelSections}
                onToggle={(sectionId, optionId) =>
                  sectionId === "groupBy" ? update({ groupBy: groupBy === optionId ? null : optionId }) : update({ filter: toggleFilter(filters, optionId) })
                }
                onExpand={() => undefined}
              />
            }
          />
        }
        end={data ? <span className={styles.selection}>{rows.length} de {data.users.length}</span> : undefined}
      />

      {error && (
        <div className={styles.alert} role="alert">
          <span>{error.message}</span>
          <Button size="sm" onClick={() => mutate()}>Reintentar</Button>
        </div>
      )}

      <div className={styles.listArea}>
        <DataTable
          caption="Usuarios"
          columns={columns}
          rowKey={(user) => user.id}
          rowLabel={(user) => user.username}
          rows={groupBy ? undefined : rows}
          groups={tableGroups}
          onToggleGroup={(key) =>
            setOpenGroups((current) => {
              const next = new Set(current);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
          selectable={canWrite}
          selected={selected}
          onSelectionChange={setSelected}
          sort={sort}
          onSortChange={(next) => update({ sort: `${next.key}:${next.dir}` })}
          onRowOpen={(user) => {
            rememberRecordList("users", rows.map((row) => row.id));
            router.push(`/settings/users/${user.id}`);
          }}
          rowTone={(user) => (user.isActive ? undefined : "muted")}
          loading={isLoading && !data}
          empty={
            <EmptyState icon={<Inbox size={iconSize.lg} />} title="Ningún usuario coincide" action={<Button onClick={() => update(clearSearch)}>Quitar filtros</Button>}>
              Los pausados aparecen con el filtro Pausados.
            </EmptyState>
          }
        />
      </div>
    </div>
  );
}
