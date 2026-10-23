# Recon map: Odoo (web, cliente de escritorio y móvil)

Alcance: los patrones de interfaz del cliente web de Odoo (barra superior, panel de
control, búsqueda, lista, kanban, formulario, historial por registro, tablero y ajustes)
aplicados a las pantallas de tu web. Única diferencia pedida: paleta azul.
Para: uso interno de tu agencia de cambio (operadores, administradores y auditores).
Fecha: 2026-10-22
Referencia: documentación de Odoo 20 (versión actual), con páginas de 18 cuando la de 20
no alcanzó. Tu instancia es Odoo 18 o posterior (su login redirige a `/odoo`).

## Reglas de este recon

- Solo fuentes públicas. No se inició sesión en ningún Odoo. Lo único visto de tu
  instancia es su página pública de inicio de sesión.
- No se leyó ni se guardó código de Odoo. Se reconstruye la estructura y el
  comportamiento con código propio.
- Nada de su logo, íconos de apps, textos ni color de marca: se usan íconos abiertos,
  textos propios y azul.
- `replica/screens/` está vacía: solo se leyó texto. Las capturas de referencia quedan
  pendientes para `/replica-design`.

## Fuentes

| # | fuente | URL | qué aportó |
| --- | --- | --- | --- |
| 1 | índice de documentación | https://www.odoo.com/documentation/ | versión actual: 20.0 |
| 2 | búsqueda, filtros y agrupación | https://www.odoo.com/documentation/18.0/applications/essentials/search.html | buscador, facetas, filtros O/Y, agrupar, favoritos, editor de filtros |
| 3 | vistas (Studio) | https://www.odoo.com/documentation/18.0/applications/studio/views.html | todos los tipos de vista y sus opciones; kanban por defecto en móvil |
| 4 | arquitectura de vistas | https://www.odoo.com/documentation/20.0/developer/reference/user_interface/view_architectures.html | estructura de formulario, lista, kanban, búsqueda y ajustes (leída en parte) |
| 5 | actividades | https://www.odoo.com/documentation/20.0/applications/essentials/activities.html | campos, colores y lugares donde aparecen |
| 6 | atajos de teclado | https://www.odoo.com/documentation/20.0/applications/essentials/keyboard_shortcuts.html | atajos con Alt, superposición, paleta Ctrl+K |
| 7 | contactos | https://www.odoo.com/documentation/20.0/applications/essentials/contacts.html | ficha de contacto, pestañas, botones inteligentes, etiquetas |
| 8 | chatter | https://www.odoo.com/documentation/20.0/applications/productivity/discuss/chatter.html | notas, mensajes, seguidores, cambios anterior → nuevo |
| 9 | exportar e importar | https://www.odoo.com/documentation/20.0/applications/essentials/export_import_data.html | selección, menú Acciones, diálogo de exportación |
| 10 | diarios | https://www.odoo.com/documentation/20.0/applications/finance/accounting/get_started/journals.html | una tarjeta por diario en el tablero, menú ⋮ |
| 11 | informes de contabilidad | https://www.odoo.com/documentation/20.0/applications/finance/accounting/reporting.html | Audit Trail y su modo restrictivo |
| 12 | usuarios | https://www.odoo.com/documentation/20.0/applications/general/users.html | lista, formulario, archivar, cambiar contraseña |
| 13 | multimoneda | https://www.odoo.com/documentation/20.0/applications/finance/accounting/get_started/multi_currency.html | monedas activas y tasas |
| 14 | notas de versión 20 | https://www.odoo.com/odoo-20-release-notes | cambios recientes de interfaz |
| 15 | precios | https://www.odoo.com/pricing | Studio, multiempresa y API solo en el plan Custom |
| 16 | tu instancia, página pública | https://mms-test.hexium.com.ar/web/login | elementos del inicio de sesión (sin iniciar sesión) |

Las páginas largas se leyeron en parte. Lo que no quedó confirmado figura como
"a confirmar" en este documento y en `features.csv`.

## Ciclo central

Encontrar registros en una lista (buscar, filtrar, agrupar), abrir uno en un
formulario, editarlo y avanzarlo de estado, con su historial al lado. En tu web:
registrar una operación, encontrarla, completarla y ver quién cambió qué.

## Pantallas

| ID | pantalla | cómo se llega | para qué | componentes clave | estados documentados |
| --- | --- | --- | --- | --- | --- |
| S01 | Inicio de sesión | `/web/login` | entrar | tarjeta centrada, correo, contraseña con mostrar, Iniciar sesión, restablecer contraseña, llave de acceso | vacío; error de credenciales a confirmar |
| S02 | Menú de apps / inicio | ícono de apps de la barra superior (`/odoo`) | elegir app | accesos a cada app, paleta Ctrl+K | a confirmar |
| S03 | Vista lista | menú de una app | ver y comparar muchos registros | panel de control, columnas ordenables, casillas, totales al pie, columnas opcionales, colores por condición, paginador de 80 | lleno, vacío con ayuda, con selección (Acciones) |
| S04 | Lista agrupada | Agrupar por en el buscador | subtotales por grupo | filas de grupo con conteo y sumas, expandir y plegar (Alt+clic en v20) | plegado, expandido |
| S05 | Kanban agrupado | selector de vistas | mover registros por etapas | columnas con contador y barra de progreso, creación rápida, arrastrar y soltar, plegar | columnas plegadas (más de 10 se cargan cerradas), vacío |
| S06 | Kanban de contactos | app Contactos | directorio visual | tarjetas con imagen, nombre, datos y etiquetas | lleno, vacío |
| S07 | Formulario con estados | clic en una fila o tarjeta | ver y editar un registro y su ciclo | encabezado con botones y barra de estados, hoja centrada, botones inteligentes, título, grupos en 2 columnas, pestañas, líneas embebidas, historial | nuevo, con cambios sin guardar (a confirmar), guardado, archivado |
| S08 | Ficha de contacto | clic en una tarjeta de contacto | datos y relaciones de un contacto | botones inteligentes, correo, teléfono, dirección, etiquetas, pestañas Contactos, Ventas y compras, Contabilidad y Notas | como S07 |
| S09 | Desplegable de búsqueda | flecha del buscador | filtrar, agrupar, favoritos | columnas Filtros, Agrupar por y Favoritos (más Comparación en informes) | con filtros por defecto, con facetas aplicadas |
| S10 | Editor de filtro personalizado | Filtros > Agregar filtro personalizado | filtros a medida | reglas campo, operador y valor; cualquiera o todas; grupos de reglas; incluir archivados | una regla, varias reglas |
| S11 | Guardar favorito | Favoritos > Guardar búsqueda actual | reutilizar búsquedas | nombre, predeterminado, compartido | privados primero, después compartidos |
| S12 | Diálogo de exportación | Acciones > Exportar | descargar datos | campos disponibles y a exportar, plantillas, XLSX o CSV | — |
| S13 | Tablero de Contabilidad | inicio de la app Contabilidad | ver cada diario de un vistazo | una tarjeta por diario, menú ⋮ con Configuración | contenido de la tarjeta a confirmar |
| S14 | Audit Trail | Contabilidad > Revisión > Audit Trail | revisar cambios | fecha y hora, usuario, tipo de cambio, valor anterior y nuevo | — |
| S15 | Ajustes | app Ajustes | configurar | ajustes agrupados por app y en bloques, un control por ajuste | cambios sin guardar a confirmar |
| S16 | Usuarios | Ajustes > Usuarios > Gestionar usuarios | administrar accesos | lista filtrable por tipo, formulario con permisos, Acciones > Archivar y Cambiar contraseña | invitación pendiente, archivado |
| S17 | Monedas | Contabilidad > Configuración > Monedas | activar monedas | interruptor Activa, pestaña Tasas | — |
| S18 | Historial del registro (chatter) | parte inferior o lateral del formulario | trazabilidad y notas | Enviar mensaje, Registrar nota, Actividades, adjuntos, seguidores, cambios anterior → nuevo, filtro y mensajes fijados (v20) | vacío, con mensajes |
| S19 | Actividades | botón del historial, reloj de la barra superior, vista actividad | tareas con vencimiento | diálogo Programar actividad (tipo, resumen, vencimiento, asignado, nota), contadores Atrasadas, Hoy y Futuras | planificada (verde), hoy (naranja), vencida (rojo), hecha |
| S20 | Paleta de comandos | Ctrl+K | navegar rápido | prefijos `/` y `@`, flechas, Ctrl+Enter abre en pestaña nueva | — |
| S21 | Superposición de atajos | mantener Alt | descubrir atajos | tecla dibujada sobre cada control | — |
| S22 | Móvil | cualquier vista en pantalla chica | usar desde el teléfono | kanban por defecto, fechas en hoja inferior (v20), panel de control compacto (a confirmar) | — |

## Flujos

Los clics son estimados a partir de la documentación; sirven como número a igualar.

```
F01 Crear un registro y avanzarlo de estado (crear una operación y completarla)
    S02 -> S03 -> S07 nuevo -> guardar -> botón de estado
    clics del camino feliz: 5, más la carga de datos
    bordes: campo obligatorio vacío, salir con cambios sin guardar, estado que solo un rol puede revertir, doble clic en el botón

F02 Buscar, filtrar y agrupar
    S03 -> escribir en el buscador -> elegir "Buscar <campo>" -> S09 -> filtro -> agrupar -> S04
    clics: 4
    bordes: sin resultados (estado vacío), dos filtros del mismo grupo (O) o de grupos distintos (Y), más de 80 resultados

F03 Guardar y reutilizar una búsqueda
    S09 -> S11 (nombre, predeterminado, compartido) -> lista con el favorito aplicado
    clics: 3
    bordes: favorito predeterminado al abrir la vista, favorito compartido de otro usuario, borrar un favorito

F04 Revisar un contacto y su cuenta
    S06 -> S08 -> botón inteligente -> S03 movimientos -> migas de pan para volver
    clics: 3
    bordes: contacto archivado, contacto sin movimientos

F05 Registrar un movimiento desde el tablero
    S13 -> botón o menú de la tarjeta -> diálogo -> guardar -> notificación
    clics: 2 (el botón exacto de la tarjeta de Odoo no está documentado)
    bordes: importe inválido, cancelar el diálogo

F06 Ver el historial y dejar una nota
    S07 -> S18 -> Registrar nota -> escribir -> enviar con Ctrl+Enter
    clics: 2
    bordes: nota con mención @, adjuntar un archivo, ver solo los cambios

F07 Acciones masivas y exportación
    S03 -> casillas -> Acciones -> Exportar -> S12 -> Exportar
    clics: n + 3
    bordes: seleccionar todos los registros del filtro, ofrecer archivar si no se puede borrar (v20)

F08 Configurar el sistema
    S02 -> S15 -> cambiar una opción -> guardar
    clics: 3
    bordes: descartar cambios

F09 Administrar usuarios
    S15 -> S16 -> Nuevo -> formulario -> guardar; Acciones > Archivar o Cambiar contraseña
    clics: 4
    bordes: contraseña débil, archivar al propio usuario (a confirmar)

F10 Navegar y volver
    S02 -> app -> menú de sección -> registro -> migas de pan (Alt+B)
    clics: 3 a 4; con Ctrl+K, 1 más el texto
    bordes: enlace compartido con filtros (v20)

F11 Editar líneas dentro de un registro (ítems de una venta distribuida)
    S07 -> lista embebida -> Agregar línea -> completar celdas -> guardar
    clics: 2 + n
    bordes: borrar una línea, totales que se recalculan, línea inválida

F12 Iniciar y cerrar sesión
    S01 -> correo y contraseña -> Iniciar sesión -> S02; menú de usuario -> Cerrar sesión
    clics: 1 + 2
    bordes: credenciales incorrectas, sesión vencida
```

## Componentes

| componente | variantes | estados | se usa en |
| --- | --- | --- | --- |
| Barra superior | con menús de sección | menú abierto | todas |
| Menú de usuario | — | abierto | todas |
| Panel de control | lista, kanban, formulario | con selección | S03 a S08, S14, S16, S17 |
| Botón | principal, secundario, de estado, de fila | normal, foco, deshabilitado, cargando | todas |
| Migas de pan | 1 a n niveles | — | S03 a S08 |
| Buscador con facetas | — | vacío, con facetas, sugerencias abiertas | S03 a S06, S14, S16 |
| Desplegable Filtros, Agrupar y Favoritos | con o sin Comparación | filtro activo | S09 |
| Editor de reglas | regla, grupo de reglas | cualquiera, todas | S10 |
| Paginador | lista, formulario | primera y última página | S03, S07 |
| Selector de vistas | lista, kanban | activo | S03, S05 |
| Tabla | normal, agrupada, editable, embebida | ordenada, con selección, vacía, cargando | S03, S04, S07 |
| Fila de grupo | con conteo y subtotales | plegada, expandida | S04 |
| Insignia de estado | pendiente, en proceso, completada, cancelada | — | S03, S05, S07 |
| Etiqueta de color | — | quitable | S06, S08 |
| Columna kanban | con barra de progreso | plegada, vacía, al soltar | S05 |
| Tarjeta kanban | contacto, operación | arrastrando, archivada | S05, S06 |
| Barra de estados | clicable, solo lectura | actual, siguiente | S07 |
| Botón inteligente | valor y etiqueta | cero | S07, S08 |
| Pestañas | — | activa | S07, S08 |
| Campos | texto, importe con moneda, fecha, selección, relación con autocompletar y crear, etiquetas, casilla, interruptor | foco, inválido, solo lectura | S07, S08, S10 |
| Historial | nota, cambio de campo, adjunto | vacío, fijado | S18 |
| Widget de actividad | — | planificada, hoy, vencida | S03, S05, S19 |
| Tarjeta de tablero | caja, banco, billetera | saldo positivo y negativo | S13 |
| Bloque de ajustes | casilla con descripción, campo | modificado | S15 |
| Diálogo | formulario, confirmación, error | — | S10 a S12, S19 |
| Notificación | éxito, aviso, error, información | auto-cierre, fija | todas |
| Estado vacío | con botón de crear | — | S03, S05, S06 |
| Indicador de carga | — | — | todas |
| Paleta de comandos | — | con resultados, sin resultados | S20 |

## Modelo de datos inferido

Se conserva el modelo de tu web (`prisma/schema.prisma`). Cada patrón de Odoo se apoya
en lo que ya existe y suma pocas entidades nuevas.

Ya existe y se reutiliza:

```
Operation        estado (PENDING | PROCESSING | COMPLETED | CANCELED), montos, cliente, proveedor
                 patrón: barra de estados, kanban por estado, colores en lista (S05, S07)
                 confianza: alta
Contact          nombre, documento, cliente o proveedor, etiquetas, isActive
                 patrón: kanban de contactos, ficha con pestañas y botones inteligentes, archivar (S06, S08)
                 confianza: alta
Tag              nombre, color -> etiquetas de colores
TreasuryAccount  nombre, tipo (CASH | BANK | WALLET), moneda, saldo -> tarjeta del tablero (S13)
Account + Transaction  saldo y movimientos con saldo acumulado -> lista agrupada (S04)
AuditLog         acción, entidad, valores anterior y nuevo, usuario, IP, fecha -> Audit Trail (S14) e historial (S18)
OperationStateHistory  cambios de estado -> cambios en el historial (S18)
InternalComment  notas, hoy solo de operaciones -> Registrar nota (S18)
Attachment       adjuntos, hoy solo de operaciones -> adjuntos del historial (S18)
User             rol ADMIN | AUDITOR | OPERATOR, tema, isActive -> usuarios (S16)
Currency         código, símbolo, decimales, isActive -> monedas (S17)
                 Odoo guarda tasas por fecha; tu web usa la cotización de cada operación y no hace falta sumarlas
Settings         formato de numeración, fecha de bloqueo contable -> ajustes (S15)
```

Nuevo para los patrones:

```
SavedFilter (favorito)  id, userId, pantalla, nombre, filtros (json), agrupación (json),
                 columnas visibles (json), esPredeterminado, esCompartido, createdAt
                 evidencia: fuente 2 (nombre, predeterminado, compartido); fuente 14 (columnas visibles)
                 confianza: alta
Historial genérico  entidad, entidadId, userId, tipo (nota | cambio), texto,
                 cambios (json: campo, anterior, nuevo), fijado, createdAt
                 evidencia: fuentes 8 y 14
                 confianza: media; puede salir de AuditLog + InternalComment sin tabla nueva (lo decide /replica-architect)
Attachment genérico  sumar entidad y entidadId; hoy solo tiene operationId
                 evidencia: fuente 8
                 confianza: media
Activity         id, entidad, entidadId, tipo, resumen, vencimiento, asignadoA, nota, hechaEn, creadaPor
                 evidencia: fuente 5
                 confianza: alta, solo si se hacen las actividades (prioridad could)
Preferencias de vista  columnas opcionales y vista por defecto, por usuario y pantalla
                 evidencia: fuente 4 (columnas opcionales); dónde las guarda Odoo: sin verificar
                 confianza: suposición; alcanza con el almacenamiento del navegador
```

Relaciones: User 1-n SavedFilter, User 1-n Activity (asignado), y cualquier entidad
1-n historial, adjuntos y actividades.

## Mapeo a tu web

| patrón de Odoo | tu pantalla hoy | qué cambia |
| --- | --- | --- |
| Barra superior y menú de apps (S02) | `Sidebar.tsx`, `Header.tsx`, `MainLayout.tsx` | barra superior con apps: Operaciones, Tesorería, Contactos, Cuentas, Auditoría, Configuración, Consola SQL y Manual |
| Inicio (S02) | Dashboard "Saldos por Contacto" | accesos por app más un resumen |
| Lista, formulario y kanban (S03 a S05, S07) | Operaciones, con modales de ficha | lista con panel de control, formulario en su propia página, kanban por estado |
| Líneas embebidas (F11) | modal de venta distribuida | formulario con líneas editables |
| Contactos (S06, S08) | Directorio de Contactos, con modal | kanban de tarjetas, lista y ficha con pestañas y botones inteligentes |
| Lista agrupada (S04) | Cuentas Ctes. | movimientos agrupados por contacto y moneda con subtotales y saldo acumulado |
| Tablero de diarios (S13) | Tesorería | una tarjeta por caja con saldo, gráfico y acciones |
| Audit Trail (S14) | Logs de Auditoría | lista con filtros, agrupación y valores anterior y nuevo |
| Ajustes, usuarios y monedas (S15 a S17) | Configuración (general, monedas, usuarios, etiquetas) | ajustes por secciones; usuarios y monedas como lista y formulario |
| Historial (S18) | "Ver Historial" de operaciones | panel de historial en cada formulario |
| Notificaciones y diálogos | `FeedbackProvider`, diálogos de tesorería | mismos usos con el estilo nuevo |
| Inicio de sesión (S01) | Iniciar sesión | tarjeta centrada en azul |
| sin equivalente | Consola SQL y Manual de Uso | se mantienen con el estilo nuevo |

También se reemplaza el sistema visual actual (`liquid-glass.css`, `tokens.css`,
`themes.css`, `responsive.css`), conservando el tema claro y oscuro.

## Matriz de funciones

Ver `features.csv`. Must: 42, should: 16, could: 19, skip: 14. Hay además 3 filas propias
de tu web (tema, Consola SQL, Manual) que no cuentan para la paridad.

## Fuera de alcance (no se puede o no se debe copiar)

- Logo, íconos de apps, textos y color violeta de Odoo: son de Odoo. Van íconos abiertos,
  textos propios y azul.
- Las apps de negocio de Odoo (ventas, inventario, CRM y demás): el alcance es la
  interfaz, no sus funciones.
- Tabla dinámica, gráfico y calendario: fuera del alcance elegido. Gantt, mapa, cohortes
  y cuadrícula: fuera de alcance.
- Studio, agentes de IA, modo sin conexión y multiempresa: servicios o planes de Odoo, o
  no aplican a una sola agencia.
- Seguidores, mensajes a externos, WhatsApp y chat interno: uso interno, sin mensajería.
- Gestor de bases de datos en el login: no corresponde y es un riesgo.
- Idiomas: la web es solo en español.

## Huecos de evidencia

- Sin capturas: medidas, colores, tipografía y espaciado quedan para `/replica-design`.
- A confirmar con capturas: contenido de la barra superior y del menú de usuario, aviso
  de cambios sin guardar, paginador del formulario, cinta de archivado, buscador de
  ajustes, contenido de las tarjetas del tablero, posición de las notificaciones y
  panel de control en móvil.
- No verifiqué si Odoo tiene tema oscuro; en tu web ya existe.

## Tamaño

Pantallas de referencia 22, flujos 12, entidades nuevas 3 a 5, pantallas de tu web a
rehacer 11.

Partes difíciles:

1. Búsqueda con agrupación y totales en el servidor: hoy las APIs paginan y filtran
   poco, y los totales tienen que ir por moneda.
2. Partir Operaciones (unas 2.050 líneas, con ventas distribuidas y confirmación de
   admin) en lista, formulario y kanban sin romper la lógica contable.
3. Historial unificado por registro con valores anterior y nuevo, juntando AuditLog,
   OperationStateHistory e InternalComment.
4. Diseño adaptable del panel de control y las listas en móvil.
5. Reemplazar el sistema visual Liquid Glass sin perder el tema claro y oscuro.

Tamaño: **L** (un trimestre) para todo el alcance; **M** (unas semanas) si se hacen solo
las 42 funciones must.
