"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Archive, ArchiveRestore, Download, Inbox, LayoutGrid, List, Mail, Phone, Plus, Settings as SettingsIcon } from "lucide-react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  ControlPanel,
  DataTable,
  EmptyState,
  FilterPanel,
  KanbanCard,
  Menu,
  Pager,
  SearchBar,
  Tag,
  ViewSwitcher,
  iconSize,
  tagColorFromHex,
  type Column,
  type SortState,
  type TableGroup,
} from "@/components/ui";
import { useShellUser } from "@/components/shell/AppShell";
import { useUiFeedback } from "@/components/shell/UiFeedback";
import { buildFacets, buildPanel, facetRemoval, fetchList, toggleFilter, useListUrlState, type FilterGroup, type GroupOption } from "@/components/shell/list-state";
import { can } from "@/lib/permissions";
import { downloadCsv } from "@/lib/csv";
import type { ContactListItem, ContactListResult } from "@/lib/resources/contacts";
import styles from "./contacts.module.css";

const PAGE_SIZE = 80;
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" };
const GROUP_OPTIONS: GroupOption[] = [{ id: "role", label: "Rol" }];

type TagRow = { id: string; name: string; color: string | null };

export const fullName = (contact: { name: string; lastname?: string | null }) => [contact.name, contact.lastname].filter(Boolean).join(" ");

const roles = (contact: ContactListItem) => [contact.isClient && "Cliente", contact.isProvider && "Proveedor"].filter(Boolean) as string[];

function ContactCard({ contact, onOpen }: { contact: ContactListItem; onOpen: () => void }) {
  const name = fullName(contact);
  return (
    <KanbanCard
      title={name}
      onOpen={onOpen}
      footer={
        <>
          <span className={styles.tags}>
            {contact.tags.slice(0, 3).map(({ tag }) => (
              <Tag key={tag.id} color={tagColorFromHex(tag.color)}>{tag.name}</Tag>
            ))}
          </span>
          <Avatar name={name} />
        </>
      }
    >
      <span className={styles.roles}>
        {roles(contact).map((role) => (
          <Badge key={role} tone="info">{role}</Badge>
        ))}
        {!contact.isActive && <Badge>Archivado</Badge>}
      </span>
      {(contact.document || contact.cuitCuil) && <span className={styles.muted}>{contact.cuitCuil ? `CUIT ${contact.cuitCuil}` : `DNI ${contact.document}`}</span>}
      {contact.email && (
        <span className={styles.line}>
          <Mail size={iconSize.xs} /> {contact.email}
        </span>
      )}
      {contact.phone && (
        <span className={styles.line}>
          <Phone size={iconSize.xs} /> {contact.phone}
        </span>
      )}
    </KanbanCard>
  );
}

export default function ContactsList() {
  const router = useRouter();
  const user = useShellUser();
  const { notify, confirm } = useUiFeedback();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const resetLocal = useCallback(() => {
    setSelected(new Set());
    setOpenGroups(new Set());
  }, []);
  const list = useListUrlState(DEFAULT_SORT, resetLocal);
  const { filters, terms, groupBy, sort, offset, update, baseQuery } = list;
  // Los contactos se ven primero como tarjetas; agrupados, solo como lista.
  const view = groupBy ? "list" : list.view ?? "kanban";

  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [openPanelGroups, setOpenPanelGroups] = useState(new Set<string>());

  const { data: tagsData } = useSWR<{ tags: TagRow[] }>("/api/tags", fetchList);
  const filterGroups: FilterGroup[] = useMemo(
    () => [
      { id: "role", label: "Rol", options: [{ id: "role:client", label: "Clientes" }, { id: "role:provider", label: "Proveedores" }] },
      { id: "status", label: "Estado", options: [{ id: "status:archived", label: "Archivados" }] },
      ...(tagsData?.tags.length
        ? [{ id: "tag", label: "Etiquetas", collapsible: true, options: tagsData.tags.map((tag) => ({ id: `tag:${tag.id}`, label: tag.name })) }]
        : []),
    ],
    [tagsData],
  );

  const listUrl = useMemo(() => {
    const params = new URLSearchParams(baseQuery);
    if (groupBy) params.set("groupBy", groupBy);
    params.set("offset", String(groupBy ? 0 : offset));
    params.set("limit", String(PAGE_SIZE));
    return `/api/contacts?${params}`;
  }, [baseQuery, groupBy, offset]);
  const { data, error, isLoading, mutate } = useSWR(listUrl, fetchList<ContactListResult>, { keepPreviousData: true });

  // Filas de los grupos abiertos (por rol): se piden con la clave del grupo.
  const groupKey = useMemo(() => (groupBy && data?.groups ? data.groups.filter((group) => openGroups.has(group.key)).map((group) => group.filter) : []), [groupBy, data, openGroups]);
  const { data: groupRows } = useSWR(groupKey.length ? ["contact-groups", baseQuery, ...groupKey] : null, async () => {
    const entries = await Promise.all(
      groupKey.map(async (filter) => {
        const params = new URLSearchParams(baseQuery);
        params.append("filter", filter);
        params.set("limit", String(PAGE_SIZE));
        const result = await fetchList<ContactListResult>(`/api/contacts?${params}`);
        return [filter, result.contacts] as const;
      }),
    );
    return Object.fromEntries(entries);
  });

  const canWrite = can(user, "contacts.write");
  const hasSearch = filters.length > 0 || terms.length > 0;
  const facets = buildFacets(list, filterGroups, GROUP_OPTIONS);
  const panelSections = buildPanel(list, filterGroups, GROUP_OPTIONS, openPanelGroups);

  const rows = data?.contacts ?? [];
  const visible = groupBy ? Object.values(groupRows ?? {}).flat() : rows;
  const selectedContacts = visible.filter((contact) => selected.has(contact.id));

  const setArchived = async (archived: boolean) => {
    const targets = selectedContacts.filter((contact) => contact.isActive === archived);
    if (!targets.length) return;
    if (archived) {
      const accepted = await confirm(`Se archivarán ${targets.length} contactos. Dejan de aparecer en las listas y al cargar operaciones, pero no se borran.`, {
        title: "Archivar contactos",
        confirmLabel: "Archivar",
      });
      if (!accepted) return;
    }
    const results = await Promise.all(
      targets.map((contact) =>
        fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !archived }) }).then((response) => response.ok, () => false),
      ),
    );
    const failed = results.filter((ok) => !ok).length;
    setSelected(new Set());
    await mutate();
    if (failed) notify(`No se pudieron actualizar ${failed} contactos`, "danger");
    else notify(archived ? "Contactos archivados" : "Contactos desarchivados", "success");
  };

  const exportSelected = () => {
    downloadCsv(`contactos-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Nombre", "Documento", "CUIT/CUIL", "Teléfono", "Email", "Dirección", "Cliente", "Proveedor", "Etiquetas"],
      ...selectedContacts.map((contact) => [
        fullName(contact),
        contact.document,
        contact.cuitCuil,
        contact.phone,
        contact.email,
        contact.address,
        contact.isClient ? "Sí" : "No",
        contact.isProvider ? "Sí" : "No",
        contact.tags.map(({ tag }) => tag.name).join(", "),
      ]),
    ]);
    notify(`Se exportaron ${selectedContacts.length} contactos`, "success");
  };

  const columns: Column<ContactListItem>[] = [
    {
      key: "name",
      label: "Nombre",
      sortable: true,
      render: (contact) => (
        <span className={styles.nameCell}>
          <Avatar name={fullName(contact)} size="sm" />
          <span className={styles.truncate}>{fullName(contact)}</span>
        </span>
      ),
    },
    { key: "document", label: "Documento", render: (contact) => contact.cuitCuil ?? contact.document ?? "—" },
    { key: "phone", label: "Teléfono", render: (contact) => contact.phone ?? "—" },
    { key: "email", label: "Email", render: (contact) => <span className={styles.truncate}>{contact.email ?? "—"}</span> },
    { key: "roles", label: "Rol", render: (contact) => roles(contact).join(" y ") || "—" },
    {
      key: "tags",
      label: "Etiquetas",
      render: (contact) => (
        <span className={styles.tags}>
          {contact.tags.map(({ tag }) => (
            <Tag key={tag.id} color={tagColorFromHex(tag.color)}>{tag.name}</Tag>
          ))}
        </span>
      ),
    },
  ];

  const tableGroups: TableGroup<ContactListItem>[] | undefined = data?.groups?.map((group) => ({
    key: group.key,
    label: group.label,
    count: group.count,
    expanded: openGroups.has(group.key),
    rows: groupRows?.[group.filter] ?? [],
  }));

  const openContact = (contact: ContactListItem) => router.push(`/contacts/${contact.id}`);

  const empty = hasSearch ? (
    <EmptyState icon={<Inbox size={iconSize.lg} />} title="Ningún contacto coincide con la búsqueda" action={<Button onClick={() => update({ filter: [], q: [] })}>Quitar filtros</Button>}>
      Probá con otro nombre, documento o teléfono.
    </EmptyState>
  ) : (
    <EmptyState
      icon={<Inbox size={iconSize.lg} />}
      title="Todavía no hay contactos"
      action={canWrite ? <Button variant="primary" icon={<Plus size={iconSize.sm} />} onClick={() => router.push("/contacts/new")}>Nuevo contacto</Button> : undefined}
    >
      Cargá a tus clientes y proveedores para usarlos en las operaciones.
    </EmptyState>
  );

  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            {canWrite && <Button variant="primary" onClick={() => router.push("/contacts/new")}>Nuevo</Button>}
            <Breadcrumbs items={[{ label: "Contactos" }]} />
            {selected.size > 0 && (
              <>
                <span className={styles.selection}>{selected.size} seleccionados</span>
                <Menu
                  label="Acciones"
                  icon={<SettingsIcon size={iconSize.sm} />}
                  items={[
                    { id: "export", label: "Exportar a CSV", icon: <Download size={iconSize.sm} />, onSelect: exportSelected },
                    ...(canWrite
                      ? [
                          { type: "divider" as const, id: "divider" },
                          { id: "archive", label: "Archivar", icon: <Archive size={iconSize.sm} />, onSelect: () => void setArchived(true) },
                          { id: "restore", label: "Desarchivar", icon: <ArchiveRestore size={iconSize.sm} />, onSelect: () => void setArchived(false) },
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
            label="Buscar contactos"
            placeholder="Buscar nombre, documento, email o teléfono..."
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
        end={
          <>
            {!groupBy && data && <Pager offset={offset} limit={PAGE_SIZE} total={data.total} onChange={(next) => update({ offset: next })} />}
            <ViewSwitcher
              value={view}
              onChange={(next) => update(next === "kanban" ? { view: next, groupBy: null } : { view: next })}
              views={[
                { id: "kanban", label: "Tarjetas", icon: <LayoutGrid size={iconSize.sm} /> },
                { id: "list", label: "Lista", icon: <List size={iconSize.sm} /> },
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
            caption="Contactos"
            columns={columns}
            rowKey={(contact) => contact.id}
            rowLabel={(contact) => fullName(contact)}
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
            onRowOpen={openContact}
            rowTone={(contact) => (contact.isActive ? undefined : "muted")}
            loading={isLoading && !data}
            empty={empty}
          />
        </div>
      ) : data && data.total === 0 ? (
        <div className={styles.listArea}>{empty}</div>
      ) : (
        <div className={styles.cards} aria-busy={isLoading && !data ? true : undefined}>
          {rows.map((contact) => (
            <ContactCard key={contact.id} contact={contact} onOpen={() => openContact(contact)} />
          ))}
        </div>
      )}
    </div>
  );
}
