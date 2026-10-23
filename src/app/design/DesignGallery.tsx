"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowLeftRight,
  Banknote,
  Clock,
  Download,
  EllipsisVertical,
  Filter,
  Inbox,
  Landmark,
  Layers,
  List,
  LogOut,
  Paperclip,
  Plus,
  Settings as SettingsIcon,
  SquareKanban,
  Star,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Checkbox,
  ControlPanel,
  CounterBadge,
  DashboardCard,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  Field,
  FilterPanel,
  FormGroup,
  FormGroups,
  FormHeader,
  HistoryComposer,
  HistoryPanel,
  IconButton,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  Menu,
  MoneyInput,
  Pager,
  ReadonlyField,
  SearchBar,
  Select,
  Setting,
  SettingsSection,
  Sheet,
  SheetTitle,
  SmartButton,
  SmartButtons,
  Spinner,
  StatusBar,
  Switch,
  TAG_COLORS,
  TabPanel,
  Tabs,
  Tag,
  TextArea,
  TextInput,
  Toast,
  ToastRegion,
  TopBar,
  ViewSwitcher,
  iconSize,
  type BadgeTone,
  type Column,
  type Facet,
  type HistoryGroup,
  type PanelSection,
  type SortState,
} from "@/components/ui";
import styles from "./DesignGallery.module.css";

type State = "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELED";
type Op = {
  id: string;
  number: string;
  date: string;
  client: string;
  provider: string;
  origin: string;
  originAmount: number;
  dest: string;
  destAmount: number;
  state: State;
};

const STATES: Record<State, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pendiente", tone: "warning" },
  PROCESSING: { label: "En proceso", tone: "info" },
  COMPLETED: { label: "Completada", tone: "success" },
  CANCELED: { label: "Cancelada", tone: "neutral" },
};

// Datos de ejemplo inventados para ver los componentes.
const OPS: Op[] = [
  { id: "1", number: "OP-000123", date: "22/10/2026", client: "Mario Pérez", provider: "Casa Norte", origin: "USD", originAmount: 1500, dest: "ARS", destAmount: 1785000, state: "PENDING" },
  { id: "2", number: "OP-000122", date: "21/10/2026", client: "Laura Sosa", provider: "Casa Norte", origin: "USD", originAmount: 800, dest: "ARS", destAmount: 952000, state: "COMPLETED" },
  { id: "3", number: "OP-000121", date: "21/10/2026", client: "Distribuidora Río", provider: "Cambios Sur", origin: "USD", originAmount: 12000, dest: "ARS", destAmount: 14256000, state: "PROCESSING" },
  { id: "4", number: "OP-000120", date: "20/10/2026", client: "Mario Pérez", provider: "Cambios Sur", origin: "EUR", originAmount: 2000, dest: "ARS", destAmount: 2590000, state: "CANCELED" },
  { id: "5", number: "OP-000119", date: "19/10/2026", client: "Laura Sosa", provider: "Casa Norte", origin: "EUR", originAmount: 500, dest: "ARS", destAmount: 647500, state: "COMPLETED" },
];

const number = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (value: number, code: string) => `${code} ${number.format(value)}`;
const sum = (ops: Op[], key: "originAmount" | "destAmount") => ops.reduce((total, op) => total + op[key], 0);

const COLOR_ROLES = [
  "bg", "surface", "muted", "border", "border-input", "text-strong", "text", "text-muted",
  "accent", "action", "positive", "negative", "success", "warning", "danger", "accent-subtle",
];

const TYPE_SCALE = [
  { token: "xl", sample: "OP-000123", note: "26/32, 700: título del formulario" },
  { token: "lg", sample: "Caja principal", note: "20/28, 600: saldo de una caja" },
  { token: "md", sample: "Operaciones", note: "16/24, 600: migas y títulos de sección" },
  { token: "base", sample: "Registrá una operación y completala", note: "14/20, 400: texto general" },
  { token: "sm", sample: "Cotización del proveedor", note: "13/18, 400: ayudas y datos secundarios" },
  { token: "xs", sample: "Hoy, 10:42", note: "12/16, 500: horas e insignias" },
];

const STEPS = [
  { id: "PENDING", label: "Pendiente" },
  { id: "PROCESSING", label: "En proceso" },
  { id: "COMPLETED", label: "Completada" },
];

export default function DesignGallery() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const setTheme = (next: boolean) => {
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    setDark(next);
  };

  const [facets, setFacets] = useState<Facet[]>([
    { id: "pending", kind: "filter", values: ["Pendientes", "En proceso"] },
    { id: "currency", kind: "group", values: ["Moneda de origen"] },
  ]);
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [dateExpanded, setDateExpanded] = useState(true);
  const [view, setView] = useState("list");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(["3"]));
  const [sort, setSort] = useState<SortState>({ key: "number", dir: "desc" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ USD: true, EUR: false });
  const [step, setStep] = useState("PENDING");
  const [tab, setTab] = useState("detail");
  const [note, setNote] = useState("");
  const [extraNotes, setExtraNotes] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lockDeletes, setLockDeletes] = useState(true);
  const [autoRates, setAutoRates] = useState(false);

  const filterSections: PanelSection[] = [
    {
      id: "filters",
      title: "Filtros",
      icon: <Filter size={iconSize.sm} />,
      iconTone: "accent",
      groups: [
        [
          { id: "pending", label: "Pendientes", active: true },
          { id: "processing", label: "En proceso", active: true },
          { id: "completed", label: "Completadas" },
        ],
        [
          {
            id: "date",
            label: "Fecha de operación",
            expanded: dateExpanded,
            options: [
              { id: "month", label: "Octubre", active: false },
              { id: "quarter", label: "4.º trimestre" },
              { id: "year", label: "2026" },
            ],
          },
        ],
        [{ id: "archived", label: "Archivadas" }],
      ],
      footerAction: { label: "Agregar filtro personalizado", onClick: () => undefined },
    },
    {
      id: "groupBy",
      title: "Agrupar por",
      icon: <Layers size={iconSize.sm} />,
      iconTone: "action",
      groups: [
        [
          { id: "state", label: "Estado" },
          { id: "currency", label: "Moneda de origen", active: true },
          { id: "client", label: "Cliente" },
          { id: "provider", label: "Proveedor" },
        ],
      ],
      footerAction: { label: "Agregar agrupación personalizada", onClick: () => undefined },
    },
    {
      id: "favorites",
      title: "Favoritos",
      icon: <Star size={iconSize.sm} />,
      iconTone: "warning",
      groups: [[{ id: "mine", label: "Mis pendientes de hoy" }]],
      footerAction: { label: "Guardar búsqueda actual", onClick: () => undefined },
    },
  ];

  const columns: Column<Op>[] = [
    { key: "number", label: "Número", sortable: true, render: (op) => <strong>{op.number}</strong> },
    { key: "date", label: "Fecha", sortable: true },
    { key: "client", label: "Cliente", sortable: true },
    { key: "provider", label: "Proveedor" },
    { key: "originAmount", label: "Monto origen", align: "end", render: (op) => amount(op.originAmount, op.origin) },
    { key: "destAmount", label: "Monto destino", align: "end", render: (op) => amount(op.destAmount, op.dest) },
    { key: "state", label: "Estado", render: (op) => <Badge tone={STATES[op.state].tone}>{STATES[op.state].label}</Badge> },
  ];

  const byCurrency = ["USD", "EUR"].map((code) => {
    const rows = OPS.filter((op) => op.origin === code);
    return {
      key: code,
      label: code,
      count: rows.length,
      expanded: Boolean(expanded[code]),
      rows,
      totals: { originAmount: amount(sum(rows, "originAmount"), code), destAmount: amount(sum(rows, "destAmount"), "ARS") },
    };
  });

  const history: HistoryGroup[] = [
    {
      label: "Hoy",
      entries: [
        ...extraNotes.map((body, index) => ({ id: `extra-${index}`, kind: "note" as const, author: "Vos", at: "Recién", body })),
        { id: "c1", kind: "change", author: "Lucía Gómez", at: "10:42", changes: [{ field: "Estado", from: "Pendiente", to: "En proceso" }] },
        { id: "n1", kind: "note", author: "Lucía Gómez", at: "10:40", body: "El cliente confirma el retiro en efectivo para mañana a las 11.", pinned: true },
      ],
    },
    {
      label: "Ayer",
      entries: [
        { id: "a1", kind: "attachment", author: "Martín Díaz", at: "17:05", fileName: "comprobante-transferencia.pdf", href: "#historial", size: "184 KB" },
        { id: "c0", kind: "change", author: "Martín Díaz", at: "16:58", changes: [{ field: "Cotización", from: "1.180,00", to: "1.190,00" }, { field: "Monto destino", from: "ARS 1.770.000,00", to: "ARS 1.785.000,00" }] },
      ],
    },
  ];

  const cardMenu = (name: string) => (
    <Menu
      label={`Acciones de ${name}`}
      icon={<EllipsisVertical size={iconSize.sm} />}
      align="end"
      size="sm"
      items={[
        { type: "heading", id: "h-view", label: "Ver" },
        { id: "movements", label: "Movimientos", onSelect: () => undefined },
        { id: "report", label: "Resumen del mes", onSelect: () => undefined },
        { type: "divider", id: "d1" },
        { id: "edit", label: "Configurar caja", icon: <SettingsIcon size={iconSize.sm} />, onSelect: () => undefined },
      ]}
    />
  );

  return (
    <div className={`ui-app ${styles.page}`}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Sistema de diseño</h1>
        <Switch label="Tema oscuro" checked={dark} onChange={(event) => setTheme(event.target.checked)} />
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Colores</h2>
          <p className={styles.note}>Roles de color. Los valores salen de replica/design/tokens.json.</p>
          <div className={styles.swatches}>
            {COLOR_ROLES.map((role) => (
              <div key={role} className={styles.swatch}>
                <span className={styles.chip} style={{ background: `var(--ui-${role})` }} />
                <span className={styles.code}>--ui-{role}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tipografía</h2>
          <div className={styles.types}>
            {TYPE_SCALE.map((type) => (
              <div key={type.token} className={styles.typeRow}>
                <span style={{ fontSize: `var(--ui-fs-${type.token})`, lineHeight: `var(--ui-lh-${type.token})`, fontWeight: `var(--ui-fw-${type.token})` }}>
                  {type.sample}
                </span>
                <span className={styles.code}>{type.token} · {type.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Botones</h2>
          <div className={styles.row}>
            <Button variant="primary" icon={<Plus size={iconSize.sm} />}>Nueva operación</Button>
            <Button>Cancelar operación</Button>
            <Button variant="ghost">Descartar</Button>
            <Button variant="danger" icon={<Trash2 size={iconSize.sm} />}>Eliminar</Button>
            <Button variant="link">Agregar línea</Button>
          </div>
          <div className={styles.row}>
            <Button variant="primary" size="sm">Guardar</Button>
            <Button size="sm">Vista previa</Button>
            <Button variant="primary" loading>Guardando</Button>
            <Button disabled>No disponible</Button>
            <IconButton icon={<Download size={iconSize.sm} />} label="Descargar" variant="secondary" />
            <IconButton icon={<Archive size={iconSize.sm} />} label="Archivar" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Campos</h2>
          <div className={styles.grid2}>
            <div className={styles.stack}>
              <Field label="Cliente" required>
                <Select defaultValue="mario">
                  <option value="mario">Mario Pérez</option>
                  <option value="laura">Laura Sosa</option>
                </Select>
              </Field>
              <Field label="Monto de origen (USD)" help="Lo que entrega el cliente.">
                <MoneyInput symbol="US$" defaultValue="1.500,00" />
              </Field>
              <Field label="Cotización" error="La cotización tiene que ser mayor a cero.">
                <TextInput defaultValue="0" />
              </Field>
            </div>
            <div className={styles.stack}>
              <Field label="Fecha de operación">
                <DateInput defaultValue="2026-10-22" />
              </Field>
              <Field label="Observaciones">
                <TextArea placeholder="Ej.: retira en efectivo por la sucursal centro" />
              </Field>
              <Field label="Documento (bloqueado)">
                <TextInput defaultValue="20-31234567-8" disabled />
              </Field>
              <Field label="Buscar en un diálogo">
                <TextInput variant="boxed" placeholder="Nombre o documento" />
              </Field>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Casillas e interruptores</h2>
          <div className={styles.row}>
            <Checkbox label="Marcada" defaultChecked />
            <Checkbox label="Sin marcar" />
            <Checkbox label="Algunas" indeterminate />
            <Checkbox label="Deshabilitada" disabled />
            <Switch label="Activa" defaultChecked />
            <Switch label="Inactiva" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Insignias, etiquetas y avatares</h2>
          <div className={styles.row}>
            {Object.values(STATES).map((state) => (
              <Badge key={state.label} tone={state.tone}>{state.label}</Badge>
            ))}
            <Badge tone="danger">Vencida</Badge>
            <CounterBadge count={3} label="actividades vencidas" />
          </div>
          <div className={styles.row}>
            {TAG_COLORS.map((color) => (
              <Tag key={color} color={color}>{color}</Tag>
            ))}
            <Tag color="blue" onRemove={() => undefined}>Mayorista</Tag>
          </div>
          <div className={styles.row}>
            <Avatar name="Lucía Gómez" size="sm" />
            <Avatar name="Martín Díaz" />
            <Avatar name="Distribuidora Río" size="lg" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Barra superior</h2>
          <div className={styles.frame}>
            <TopBar
              appName="Operaciones"
              sections={[
                { id: "all", label: "Todas", href: "/design", active: true },
                { id: "distributed", label: "Ventas distribuidas", href: "/design" },
                {
                  id: "reports",
                  label: "Reportes",
                  items: [
                    { id: "by-currency", label: "Por moneda", onSelect: () => undefined },
                    { id: "by-client", label: "Por cliente", onSelect: () => undefined },
                  ],
                },
              ]}
              end={
                <>
                  <span className={styles.systray}>
                    <IconButton icon={<Clock size={iconSize.md} />} label="Actividades" />
                    <CounterBadge count={3} label="actividades vencidas" />
                  </span>
                  <Menu
                    label="Menú de usuario"
                    align="end"
                    items={[
                      { type: "heading", id: "who", label: "Lucía Gómez · Administración" },
                      { id: "profile", label: "Mi perfil", icon: <User size={iconSize.sm} />, onSelect: () => undefined },
                      { id: "theme", label: dark ? "Usar tema claro" : "Usar tema oscuro", onSelect: () => setTheme(!dark) },
                      { type: "divider", id: "d" },
                      { id: "logout", label: "Cerrar sesión", icon: <LogOut size={iconSize.sm} />, onSelect: () => undefined },
                    ]}
                  >
                    <Avatar name="Lucía Gómez" />
                  </Menu>
                </>
              }
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Panel de control, buscador y lista</h2>
          <div className={styles.frame}>
            <ControlPanel
              start={
                <>
                  <Button variant="primary">Nuevo</Button>
                  <Breadcrumbs items={[{ label: "Operaciones" }]} />
                  <Menu
                    label="Acciones"
                    icon={<SettingsIcon size={iconSize.sm} />}
                    items={[
                      { id: "export", label: "Exportar seleccionadas", icon: <Download size={iconSize.sm} />, onSelect: () => undefined },
                      { id: "archive", label: "Archivar", icon: <Archive size={iconSize.sm} />, onSelect: () => undefined },
                      { type: "divider", id: "d" },
                      { id: "delete", label: "Eliminar", icon: <Trash2 size={iconSize.sm} />, danger: true, onSelect: () => undefined },
                    ]}
                  />
                </>
              }
              search={
                <SearchBar
                  facets={facets}
                  query={query}
                  onQueryChange={setQuery}
                  onRemoveFacet={(id) => setFacets((current) => current.filter((facet) => facet.id !== id))}
                  panelOpen={panelOpen}
                  onTogglePanel={() => setPanelOpen((open) => !open)}
                  label="Buscar operaciones"
                  placeholder="Buscar cliente, proveedor o número..."
                  panel={<FilterPanel sections={filterSections} onToggle={() => undefined} onExpand={() => setDateExpanded((value) => !value)} />}
                />
              }
              end={
                <>
                  <Pager offset={offset} limit={80} total={230} onChange={setOffset} />
                  <ViewSwitcher
                    value={view}
                    onChange={setView}
                    views={[
                      { id: "list", label: "Lista", icon: <List size={iconSize.sm} /> },
                      { id: "kanban", label: "Kanban", icon: <SquareKanban size={iconSize.sm} /> },
                    ]}
                  />
                </>
              }
            />
            <DataTable
              caption="Operaciones agrupadas por moneda de origen"
              columns={columns}
              rowKey={(op) => op.id}
              rowLabel={(op) => op.number}
              groups={byCurrency}
              onToggleGroup={(key) => setExpanded((current) => ({ ...current, [key]: !current[key] }))}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
              sort={sort}
              onSortChange={setSort}
              onRowOpen={() => undefined}
              rowTone={(op) => (op.state === "CANCELED" ? "muted" : undefined)}
              totals={{ destAmount: amount(sum(OPS, "destAmount"), "ARS") }}
            />
          </div>
          <div className={styles.grid2}>
            <div className={styles.frame}>
              <DataTable caption="Lista cargando" columns={columns.slice(0, 4)} rowKey={(op) => op.id} rows={[]} loading />
            </div>
            <div className={styles.frame}>
              <DataTable
                caption="Lista vacía"
                columns={columns.slice(0, 4)}
                rowKey={(op) => op.id}
                rows={[]}
                empty={
                  <EmptyState
                    icon={<Inbox size={iconSize.lg} />}
                    title="Todavía no hay operaciones"
                    action={<Button variant="primary" icon={<Plus size={iconSize.sm} />}>Nueva operación</Button>}
                  >
                    Registrá la primera compra o venta de divisas para verla acá.
                  </EmptyState>
                }
              />
            </div>
          </div>
        </section>

        <section className={styles.section} id="historial">
          <h2 className={styles.sectionTitle}>Formulario e historial</h2>
          <div className={`${styles.frame} ${styles.formLayout}`}>
            <div>
              <FormHeader
                actions={
                  <>
                    <Button variant="primary">Completar</Button>
                    <Button>Cancelar operación</Button>
                  </>
                }
                status={<StatusBar steps={STEPS} current={step} onSelect={setStep} />}
              />
              <Sheet>
                <SheetTitle
                  eyebrow="Operación"
                  aside={
                    <SmartButtons>
                      <SmartButton icon={<ArrowLeftRight size={iconSize.md} />} value={4} label="Movimientos" />
                      <SmartButton icon={<Wallet size={iconSize.md} />} value="ARS 1.785.000" label="Cuenta corriente" />
                    </SmartButtons>
                  }
                >
                  OP-000123
                </SheetTitle>
                <FormGroups>
                  <FormGroup title="Partes">
                    <Field label="Cliente" layout="inline" required>
                      <Select defaultValue="mario">
                        <option value="mario">Mario Pérez</option>
                        <option value="laura">Laura Sosa</option>
                      </Select>
                    </Field>
                    <Field label="Proveedor" layout="inline">
                      <Select defaultValue="norte">
                        <option value="norte">Casa Norte</option>
                        <option value="sur">Cambios Sur</option>
                      </Select>
                    </Field>
                    <ReadonlyField label="Fecha">22/10/2026</ReadonlyField>
                  </FormGroup>
                  <FormGroup title="Importes">
                    <Field label="Monto origen (USD)" layout="inline">
                      <MoneyInput symbol="US$" defaultValue="1.500,00" />
                    </Field>
                    <Field label="Cotización" layout="inline">
                      <TextInput defaultValue="1.190,00" inputMode="decimal" />
                    </Field>
                    <ReadonlyField label="Monto destino">ARS 1.785.000,00</ReadonlyField>
                  </FormGroup>
                </FormGroups>
                <Tabs
                  idPrefix="op"
                  label="Secciones de la operación"
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    { id: "detail", label: "Líneas" },
                    { id: "payment", label: "Pago al proveedor" },
                    { id: "notes", label: "Observaciones" },
                  ]}
                />
                <TabPanel idPrefix="op" tabId="detail" active={tab === "detail"}>
                  <DataTable
                    caption="Líneas de la operación"
                    columns={[
                      { key: "client", label: "Cliente" },
                      { key: "originAmount", label: "Monto", align: "end", render: (op: Op) => amount(op.originAmount, op.origin) },
                      { key: "state", label: "Cobrado", render: (op: Op) => (op.state === "COMPLETED" ? "Sí" : "No") },
                    ]}
                    rowKey={(op) => op.id}
                    rows={OPS.slice(0, 2)}
                    totals={{ originAmount: amount(sum(OPS.slice(0, 2), "originAmount"), "USD") }}
                  />
                  <div className={styles.addLine}>
                    <Button variant="link" icon={<Plus size={iconSize.sm} />}>Agregar línea</Button>
                  </div>
                </TabPanel>
                <TabPanel idPrefix="op" tabId="payment" active={tab === "payment"}>
                  <FormGroup>
                    <ReadonlyField label="Pagado">No</ReadonlyField>
                    <ReadonlyField label="Moneda de pago">ARS</ReadonlyField>
                  </FormGroup>
                </TabPanel>
                <TabPanel idPrefix="op" tabId="notes" active={tab === "notes"}>
                  <TextArea placeholder="Observaciones de la operación" aria-label="Observaciones" />
                </TabPanel>
              </Sheet>
            </div>
            <HistoryPanel
              toolbar={
                <>
                  <Button variant="primary" size="sm">Registrar nota</Button>
                  <Button size="sm" icon={<Paperclip size={iconSize.sm} />}>Adjuntar</Button>
                  <Button size="sm" icon={<Clock size={iconSize.sm} />}>Actividad</Button>
                </>
              }
              composer={
                <HistoryComposer
                  value={note}
                  onChange={setNote}
                  onSubmit={() => {
                    setExtraNotes((current) => [note.trim(), ...current]);
                    setNote("");
                  }}
                />
              }
              groups={history}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Kanban</h2>
          <div className={styles.frame}>
            <KanbanBoard label="Operaciones por estado">
              {(["PENDING", "PROCESSING", "COMPLETED"] as State[]).map((state) => {
                const ops = OPS.filter((op) => op.state === state);
                return (
                  <KanbanColumn
                    key={state}
                    title={STATES[state].label}
                    count={ops.length}
                    total={amount(sum(ops, "destAmount"), "ARS")}
                    onQuickCreate={() => undefined}
                    progress={[
                      { id: "paid", tone: "success", count: ops.filter((op) => op.state === "COMPLETED").length, label: "Cobradas" },
                      { id: "today", tone: "warning", count: ops.filter((op) => op.state === "PENDING").length, label: "Vencen hoy" },
                      { id: "rest", tone: "neutral", count: ops.filter((op) => op.state === "PROCESSING").length, label: "En curso" },
                    ]}
                  >
                    {ops.map((op) => (
                      <KanbanCard
                        key={op.id}
                        title={op.number}
                        onOpen={() => undefined}
                        footer={
                          <>
                            <Tag color={op.origin === "USD" ? "green" : "indigo"}>{op.origin}</Tag>
                            <Avatar name={op.client} size="sm" />
                          </>
                        }
                      >
                        <span>{amount(op.originAmount, op.origin)} → {amount(op.destAmount, op.dest)}</span>
                        <span className={styles.muted}>{op.client}</span>
                      </KanbanCard>
                    ))}
                  </KanbanColumn>
                );
              })}
            </KanbanBoard>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tablero de tesorería</h2>
          <div className={styles.cards}>
            <DashboardCard
              icon={<Banknote size={iconSize.md} />}
              title="Caja principal"
              subtitle="Efectivo · ARS"
              balance={amount(2450000, "ARS")}
              primaryAction={<Button variant="primary" size="sm">Nuevo movimiento</Button>}
              secondaryAction={<Button size="sm">Transferir</Button>}
              menu={cardMenu("Caja principal")}
              lines={[
                { label: "Ingresos del mes", value: amount(5320000, "ARS") },
                { label: "Egresos del mes", value: amount(2870000, "ARS") },
              ]}
              series={[1.2, 1.6, 1.4, 1.9, 2.1, 1.8, 2.45]}
              seriesLabel="Saldo de los últimos siete días, en alza"
            />
            <DashboardCard
              icon={<Landmark size={iconSize.md} />}
              title="Cuenta bancaria"
              subtitle="Banco · USD"
              balance={amount(18250, "USD")}
              primaryAction={<Button variant="primary" size="sm">Nuevo movimiento</Button>}
              menu={cardMenu("Cuenta bancaria")}
              lines={[{ label: "Último movimiento", value: "Ayer, 17:05" }]}
              series={[20, 19.5, 19.8, 18.9, 18.4, 18.6, 18.25]}
              seriesLabel="Saldo de los últimos siete días, en baja"
            />
            <DashboardCard
              icon={<Wallet size={iconSize.md} />}
              title="Billetera"
              subtitle="Billetera · USDT"
              balance={amount(-120, "USDT")}
              balanceTone="negative"
              primaryAction={<Button variant="primary" size="sm">Nuevo movimiento</Button>}
              menu={cardMenu("Billetera")}
              lines={[{ label: "Pendiente de acreditar", value: amount(300, "USDT") }]}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ajustes</h2>
          <SettingsSection title="Operaciones">
            <Setting
              title="Bloquear el borrado de operaciones"
              description="Las operaciones auditadas solo se pueden cancelar o archivar."
              htmlFor="lock-deletes"
              control={<Switch id="lock-deletes" checked={lockDeletes} onChange={(event) => setLockDeletes(event.target.checked)} />}
            />
            <Setting title="Numeración" description="Formato del número de cada operación.">
              <Field label="Formato">
                <TextInput defaultValue="OP-{000000}" />
              </Field>
            </Setting>
            <Setting
              title="Actualizar cotizaciones automáticamente"
              description="Trae las cotizaciones del día al abrir una operación."
              htmlFor="auto-rates"
              control={<Checkbox id="auto-rates" checked={autoRates} onChange={(event) => setAutoRates(event.target.checked)} />}
            />
          </SettingsSection>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Diálogo, avisos y carga</h2>
          <div className={styles.row}>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>Abrir diálogo</Button>
            <Spinner label="Cargando operaciones" />
          </div>
          <ToastRegion inline>
            <Toast tone="success" title="Operación completada" onClose={() => undefined}>OP-000123 actualizó la caja principal.</Toast>
            <Toast tone="info" title="Hay 2 operaciones nuevas" />
            <Toast tone="warning" title="La cotización cambió desde que abriste la operación" />
            <Toast tone="danger" title="No se pudo guardar" onClose={() => undefined}>Revisá la conexión y volvé a intentarlo.</Toast>
          </ToastRegion>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Nuevo movimiento de caja"
            footer={
              <>
                <Button variant="primary" onClick={() => setDialogOpen(false)}>Guardar</Button>
                <Button onClick={() => setDialogOpen(false)}>Descartar</Button>
              </>
            }
          >
            <div className={styles.stack}>
              <Field label="Tipo">
                <Select defaultValue="income">
                  <option value="income">Ingreso</option>
                  <option value="expense">Egreso</option>
                </Select>
              </Field>
              <Field label="Monto (ARS)">
                <MoneyInput symbol="$" placeholder="0,00" />
              </Field>
              <Field label="Concepto">
                <TextInput placeholder="Ej.: aporte de capital" />
              </Field>
            </div>
          </Dialog>
        </section>
      </main>
    </div>
  );
}
