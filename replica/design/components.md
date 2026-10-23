# Componentes de la interfaz nueva

Especificación de cada componente del recon (`replica/recon.md`, sección Componentes).
Los valores salen de `tokens.json`; en código se usan como `var(--ui-…)` desde
`src/styles/ui-tokens.css`. Los componentes viven en `src/components/ui/` y se ven
juntos en `/design` (solo en desarrollo).

Reglas de todos:

- Solo tokens: ningún color, tamaño ni sombra escrito a mano en un componente.
- Íconos de Lucide (licencia ISC). Ningún ícono, ilustración ni texto de Odoo.
- Foco visible: contorno de 2 px en `focus`, separado 2 px.
- Objetivo táctil de 32 px o más en controles; en móvil, 40 px.
- Textos propios en español.

```
Button
  variants  primary (acción principal), secondary, ghost, danger, link
  sizes     sm 28px, md 32px
  states    default, hover, active, focus-visible, disabled, loading (ícono que gira; mantiene el texto)
  tokens    primary: bg accent / on-accent, hover accent-hover, active accent-active
            secondary: bg muted / text, hover muted-hover; danger: bg danger / on-danger
            radius sm, font base/500
  a11y      <button> real, type="button" por defecto, aria-busy mientras carga
  used on   todas

IconButton
  variants  las de Button
  sizes     sm 28x28, md 32x32
  states    las de Button
  tokens    las de Button
  a11y      aria-label obligatorio, title con el mismo texto
  used on   S03 a S08, S13, S18

TextInput, TextArea, MoneyInput, DateInput, Select
  variants  underline (formularios, como Odoo), boxed (buscador, diálogos)
  sizes     field-h 28px (underline), control-h 32px (boxed)
  states    default, hover (borde text-muted), focus (subrayado focus de 2px), invalid (borde danger),
            disabled (borde punteado), placeholder
  tokens    texto text-strong, borde border-input, placeholder placeholder, font base/400
  a11y      siempre con <label> (Field); aria-invalid y aria-describedby los pone Field;
            MoneyInput: inputmode decimal y la moneda en la etiqueta; el símbolo es decorativo
  used on   S07, S08, S10, S11, S15, S16, S17, diálogos de tesorería

Field
  variants  stacked (etiqueta arriba), inline (etiqueta a la izquierda, como Odoo)
  states    con ayuda, con error (role="alert"), obligatorio (asterisco decorativo)
  tokens    etiqueta text-strong sm/600, ayuda text-muted sm, error danger sm
  a11y      label htmlFor; conecta ayuda y error con aria-describedby
  used on   S07, S08, S10, S15

Checkbox, Switch
  sizes     16px (casilla), 32x18 (interruptor)
  states    sin marcar, marcado, indeterminado (casilla), focus, disabled
  tokens    borde border-input, marcado action con tilde on-accent
  a11y      input nativo; el interruptor con role="switch"
  used on   S03 (selección), S15, S16, S17

Badge
  variants  neutral, info, success, warning, danger
  sizes     xs 12px, alto 20px, forma de píldora
  tokens    bg y texto de cada tono (success-bg y success-text, etc.)
  a11y      el texto dice el estado; nunca solo el color
  used on   S03, S05, S07 (estado de operación)

CounterBadge
  tokens    bg counter, texto on-counter, xs/700
  a11y      aria-label con número y qué cuenta ("3 actividades vencidas")
  used on   barra superior (actividades)

Tag
  variants  10 colores: gray, red, orange, yellow, green, teal, blue, indigo, purple, pink
  states    con botón para quitar
  tokens    tag-<color>-bg y tag-<color>-text, radius pill, xs/500
  a11y      el botón de quitar dice "Quitar etiqueta X"
  used on   S06, S08, filtros

Avatar
  sizes     20, 24, 32px
  tokens    color estable por nombre, tomado de la paleta de etiquetas
  a11y      role="img" con el nombre
  used on   barra superior, S06, S18

Tabs (pestañas del formulario)
  states    activa (fondo surface, borde superior accent de 2px), inactiva (texto text-muted), hover, focus
  sizes     tab-h 36px
  a11y      role tablist, tab y tabpanel; flechas izquierda y derecha, Inicio y Fin
  used on   S07, S08

Dialog
  sizes     sm 420px, md 640px, lg 880px
  states    abierto; se cierra con Escape, con la X o con un clic afuera
  tokens    surface, shadow dialog, radius lg; pie con botones alineados a la izquierda
  a11y      <dialog> nativo modal: bloquea el fondo, enfoca el primer control y devuelve el foco al cerrar;
            aria-labelledby al título
  used on   S10, S11, S12, S19, diálogos de tesorería y confirmaciones

Toast
  variants  info, success, warning, danger
  states    automático (se cierra solo), fijo
  tokens    surface con borde izquierdo de 4px del tono, shadow pop
  a11y      role="status" (danger: role="alert"); botón cerrar con nombre
  used on   todas

Menu (desplegable)
  variants  ítem, ítem con ícono, ítem peligroso, separador, título de grupo
  states    abierto, ítem activo, ítem deshabilitado
  sizes     menu-item-h 28px
  tokens    surface, shadow pop, radius md, hover surface-hover
  a11y      aria-haspopup y aria-expanded en el botón; role menu y menuitem; flechas, Inicio, Fin,
            Escape (devuelve el foco), clic afuera cierra
  used on   Acciones, menú de usuario, menú de tarjeta, menús de sección

Breadcrumbs
  states    niveles anteriores como enlace (action); el actual en text-strong y semibold
  a11y      nav con aria-label="Ruta"; el último con aria-current="page"
  used on   S03 a S08, S13 a S17

Pager
  variants  rango de lista ("1-80 / 230"), registro ("3 / 45")
  states    primera página y última (flecha deshabilitada), sin registros (se oculta)
  a11y      el texto se anuncia con aria-live="polite"; flechas con nombre
  used on   S03, S07

ViewSwitcher
  states    vista activa (surface con borde action), inactiva (muted)
  a11y      grupo de botones con aria-pressed y nombre de cada vista
  used on   S03, S05

SearchBar
  variants  facetas de filtro, de agrupación, de favorito y de campo
  states    vacío, con facetas, panel abierto, foco
  tokens    caja con borde border-input; faceta: bloque de ícono accent + etiqueta sobre muted
  a11y      input type="search" con etiqueta; cada faceta con botón "Quitar"; Retroceso con el
            campo vacío quita la última faceta; el botón del panel con aria-expanded
  used on   S03 a S06, S09, S14, S16

FilterPanel
  variants  columnas Filtros, Agrupar por y Favoritos; opciones con sub-opciones (períodos)
  layout    una columna por sección si el panel mide 540px o más; si no, apiladas (container query)
  states    opción activa (tilde action y 500), grupo separado por línea
  a11y      botones con aria-pressed; cada columna con su título
  used on   S09, S11

ControlPanel
  layout    izquierda: Nuevo, migas y Acciones; centro: buscador; derecha: paginador y vistas.
            Desde lg, una fila. Entre sm y lg, el buscador baja a una segunda fila. En teléfono,
            tres filas: migas, buscador, y paginador con vistas. Las migas recortan con "…"
  tokens    surface, borde inferior border
  used on   S03 a S08, S13 a S17

TopBar
  layout    botón de apps, nombre de la app, menús de sección y, a la derecha, actividades y usuario.
            Debajo de md, los menús de sección pasan a un botón de menú
  sizes     topbar-h 48px
  tokens    surface, borde inferior border, sección activa con muted
  a11y      nav con aria-label="Principal"; sección actual con aria-current="page"
  used on   todas

DataTable (lista)
  variants  simple, con selección, agrupada (filas de grupo con conteo y subtotales), con totales al pie
  states    hover, fila seleccionada (accent-subtle), cargando (filas grises), vacía (EmptyState),
            fila con tono (muted, danger, success, warning)
  sizes     row-h 40px, encabezado 40px
  tokens    encabezado bg / text-strong 600, bordes border, números a la derecha con cifras tabulares
  a11y      <table> con caption oculto; aria-sort en el encabezado ordenado; filas que abren el
            registro con Enter; casillas con nombre ("Seleccionar fila OP-000012"); el grupo es un
            botón con aria-expanded
  used on   S03, S04, S14, S16, S17 y las líneas embebidas de S07

StatusBar
  states    pasada y futura (muted / text-muted), actual (accent-subtle con borde action, texto accent 600),
            clicable (hover muted-hover) o solo lectura
  tokens    forma de flecha con clip-path; alto control-h
  a11y      grupo con aria-label="Estado"; el actual con aria-current="step"
  used on   S07

SmartButton
  states    default, hover, con valor cero
  tokens    surface, borde border, valor text-strong 600, etiqueta text-muted sm, ícono action
  a11y      botón o enlace con el texto completo ("12 operaciones")
  used on   S07, S08

FormSheet (encabezado, hoja, título, grupos y filas)
  layout    encabezado con acciones a la izquierda y barra de estados a la derecha; hoja centrada de
            hasta sheet-max sobre bg; botones inteligentes arriba a la derecha; título xl/700;
            grupos en dos columnas desde lg; etiquetas en columna de ancho automático, como Odoo
  tokens    surface, borde border, padding 24 y 32
  used on   S07, S08

KanbanColumn, KanbanCard
  states    columna: con barra de progreso, plegada (could), vacía; tarjeta: hover (shadow card), tono
  sizes     columna kanban-col-w 320px; tarjeta con padding card-pad 8px
  tokens    columna bg; tarjeta surface con borde border y radius sm; progreso success, warning, danger, muted
  a11y      la tarjeta es un article con un botón en el título que la abre; la barra de progreso
            tiene un texto oculto con los conteos
  used on   S05, S06

DashboardCard, Sparkline (diseño propio: Odoo no muestra estas tarjetas en fuentes públicas)
  layout    ícono del tipo de caja, nombre, moneda, menú ⋮; saldo grande; acción principal;
            líneas de resumen; gráfico de evolución
  states    saldo positivo (positive), negativo (negative), sin movimientos
  tokens    surface, borde border, radius md, gráfico action
  a11y      el gráfico es role="img" con un texto que resume la tendencia
  used on   S13

HistoryPanel (historial del registro)
  variants  nota, cambio de campos (anterior → nuevo), adjunto; separador por fecha
  states    vacío, con entradas, nota fijada, filtrado (todo, notas, cambios)
  tokens    autor text-strong 600, hora text-muted xs, cambios con flecha text-muted
  a11y      lista con un encabezado por fecha; el compositor tiene su etiqueta
  used on   S07, S08, S18

EmptyState
  tokens    ícono text-muted de 40px, título md/600, texto text-muted
  a11y      el botón de crear lleva el nombre de lo que crea
  used on   S03, S05, S06, S18

Spinner
  a11y      role="status" con texto oculto ("Cargando")
  used on   todas

SettingsSection, Setting
  layout    sección con título sobre banda muted; ajustes en dos columnas desde lg; cada ajuste con
            control a la izquierda, título, descripción y controles extra
  a11y      el título del ajuste es la etiqueta de su control
  used on   S15
```

Funciones could (se diseñan, se construyen cuando se haga cada una):

```
ActivityWidget   reloj con color (success planificada, warning hoy, danger vencida) y texto oculto
CommandPalette   diálogo con buscador, resultados con flechas y Enter, prefijos / y @
RuleEditor       filas campo, operador y valor; grupos de reglas; selector cualquiera o todas
```
