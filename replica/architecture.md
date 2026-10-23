# Arquitectura: Nachito con la interfaz de Odoo (patrones de interfaz, en azul)

Lee `replica/recon.md` y `replica/features.csv`. El SQL está en `replica/schema.sql`.
No hace falta copiar la arquitectura de Odoo (ORM, acciones, vistas en XML): alcanza con
sus patrones de interfaz sobre el stack que ya tenés.

## Stack

| capa | elección | por qué |
| --- | --- | --- |
| web | Next.js 14 (App Router) + TypeScript | es lo que ya tenés; las pantallas nuevas son rutas como `/operations/[id]` |
| estilos | variables CSS (tokens de `/replica-design`) + CSS modules | ya usás CSS modules; sumar Tailwind obligaría a reescribir todo dos veces |
| datos en el cliente | SWR | ya está instalado; sirve para listas, grupos y paginado |
| base de datos | PostgreSQL 18 en Neon | la actual; una sola base |
| desarrollo | Postgres local de `docker-compose.yml` o una rama de Neon | hoy hay una sola base y tiene datos reales |
| ORM y migraciones | Prisma 5 con `prisma migrate` (migración inicial del esquema actual) | hoy se usa `db push`, que no deja historial ni permite revisar cambios |
| autenticación | sesiones propias con cookie y bcrypt | ya funcionan; los roles ADMIN, AUDITOR y OPERATOR se mantienen |
| permisos | una función `can(usuario, acción, recurso, registro)` en la capa de datos | no hay RLS: Prisma entra con un solo usuario de base |
| archivos | disco del servidor fuera de `public/`, detrás de una interfaz | hoy `/uploads` es público; si se aloja en un servicio sin disco (Vercel), pasar a R2 o S3 |
| gráficos | SVG propio | solo hace falta un gráfico chico por caja |
| exportación | CSV en el servidor; XLSX después con exceljs | CSV no necesita dependencias |
| pagos | ninguno | herramienta interna |
| correo | ninguno | no hay mensajería en el alcance |
| tareas programadas | limpieza diaria de sesiones vencidas (opcional) | hoy las 12 sesiones guardadas están vencidas |
| hosting | el actual, sin cambios | el repo no indica dónde se aloja; ver "archivos" |

### Cómo se organiza el código

- `src/lib/resources/<recurso>.ts`: una configuración por recurso (campos, búsqueda,
  filtros, agrupaciones, orden, columnas y permisos). La usan la API y los componentes.
- `src/lib/list-query.ts`: traduce `q`, `filter`, `groupBy`, `sort` y `page` según esa
  configuración. Solo acepta identificadores de la lista blanca del recurso.
- `src/lib/permissions.ts`: `can()` con la matriz de roles. Cada ruta la llama.
- `src/lib/history.ts`: arma el historial de un registro con AuditLog, cambios de
  estado, notas y adjuntos.
- Componentes: `shell/` (barra superior, menú de apps, menú de usuario, migas) y
  `views/` (panel de control, buscador, lista, kanban, formulario, barra de estados,
  botón inteligente, pestañas, historial).

### Contrato de listas

```
GET /api/<recurso>?q=texto&filter=state:pending&filter=date:this_month
                  &groupBy=originCurrencyId&sort=operationDate:desc&page=1&limit=80

sin groupBy -> { records, total, page, limit }
con groupBy -> { groups: [{ key, label, count, totals: [{ currencyId, code, sum }] }], total }
```

- Filtros del mismo grupo se combinan con O, y de grupos distintos con Y (como Odoo).
- Para abrir un grupo se repite la llamada con la clave del grupo como filtro.
- Página por defecto 80 y máximo 100.
- Los totales siempre van por moneda: nunca se suman importes de monedas distintas.

### Matriz de permisos propuesta (para confirmar)

| acción | ADMIN | OPERATOR | AUDITOR |
| --- | --- | --- | --- |
| ver operaciones, contactos, cuentas y tesorería | sí | sí | sí |
| crear y editar operaciones, contactos y movimientos | sí | sí | no |
| reabrir una operación completada | sí | no | no |
| eliminar una operación | sí | no | no |
| ver auditoría y el historial completo (valores, IP) | sí | no | sí |
| notas y adjuntos | sí | sí | sí (solo notas) |
| ajustes, usuarios y monedas | sí | no | solo ver |

Hoy las rutas de edición y de borrado de operaciones y contactos solo piden una sesión
iniciada: un AUDITOR puede editar y cualquier rol puede eliminar una operación. La
matriz cierra eso, pero cambia permisos y conviene confirmarla antes de construir.

## Esquema

Tablas nuevas: 4 (`SavedFilter`, `RecordNote`, `Attachment` rehecha y `Activity`), 2
columnas nuevas en `Settings` y 15 índices nuevos en tablas existentes. Permisos: una
verificación de autorización en la capa de datos por cada consulta, con `can()`.

- `SavedFilter` (favoritos): dueño `userId`, se borra con el usuario. Un solo
  predeterminado por usuario y pantalla, con un índice único parcial.
- `RecordNote` (notas de cualquier registro): reemplaza a `InternalComment`, que no tiene
  filas ni uso. Las notas no se editan ni se borran, solo se fijan, para respetar la
  trazabilidad.
- `Attachment`: se rehace (no tiene filas) para cualquier registro, con tipo, tamaño y
  hash, y el archivo fuera de `public/`.
- `Activity` (could): fecha de vencimiento como `date` de calendario. El estado se
  calcula en la zona horaria de Ajustes.
- `Settings`: `restrictiveAuditTrail` (bloquea eliminar operaciones; solo cancelar) y
  `timeZone` (America/Argentina/Buenos_Aires).
- Historial de cambios: sale de `AuditLog` y `OperationStateHistory`, sin tabla nueva.
  Odoo 20 hace lo mismo: genera los mensajes de seguimiento al vuelo.

Desvíos a propósito de la regla general de la skill:

- Ids text con UUID en lugar de `uuid`: las claves foráneas apuntan a `"User".id`, que es text.
- Importes en `Float`: no hay importes nuevos. Pasar los existentes a `Decimal` o a
  centavos es otro trabajo. Mientras tanto se redondea por los decimales de cada moneda.

Ver `replica/schema.sql`. Su sintaxis está revisada; la ejecución real se prueba en la
base local.

## API

Una tabla por flujo del recon. "Nueva" es una ruta que no existe; "cambia" es una
existente con otro contrato.

F01 Crear y avanzar de estado una operación

| método y ruta | qué hace | quién | entrada | salida |
| --- | --- | --- | --- | --- |
| GET /api/operations/[id] (nueva) | trae la operación con contactos, monedas, líneas y contadores de botones inteligentes | todos | id | operación + contadores |
| POST /api/operations (cambia) | crea; acepta un id generado en el cliente para que un doble envío no duplique | ADMIN, OPERATOR | campos + id opcional | 201 nueva, 200 si el id ya existía |
| PUT /api/operations/[id] (cambia) | edita; rechaza si el registro cambió desde que se abrió | ADMIN, OPERATOR | campos + updatedAt | operación o 409 |
| PATCH /api/operations/[id] (existe) | cambia estado o pago, con bloqueo de fila | ADMIN, OPERATOR; reabrir solo ADMIN | state, isPaid | operación |
| DELETE /api/operations/[id] (cambia) | baja lógica; bloqueada si el bloqueo de borrado está activo; conserva historial y adjuntos | ADMIN | id | ok o 409 |

F02 Buscar, filtrar y agrupar (todas con el contrato de listas)

| método y ruta | qué hace | quién |
| --- | --- | --- |
| GET /api/operations (cambia) | estado, fechas, cliente, proveedor y monedas; totales por moneda | todos |
| GET /api/contacts (cambia) | etiquetas, cliente o proveedor, archivados | todos |
| GET /api/accounts (cambia) | por contacto y moneda, con saldo | todos |
| GET /api/audit (cambia) | usuario, acción, entidad y fecha; paginada (hoy trae 500 filas fijas) | ADMIN, AUDITOR |
| GET /api/users (cambia) | rol y archivados | ADMIN, AUDITOR |
| GET /api/currencies (cambia) | activas e inactivas | todos |

F03 Favoritos

| método y ruta | qué hace | quién | entrada | salida |
| --- | --- | --- | --- | --- |
| GET /api/saved-filters (nueva) | propios y compartidos de una pantalla | todos | screen | lista |
| POST /api/saved-filters (nueva) | guarda la búsqueda actual | todos | screen, name, filters, groupBy, columns, isDefault, isShared | favorito |
| PATCH /api/saved-filters/[id] (nueva) | renombrar, predeterminado, compartido | dueño o ADMIN | campos | favorito |
| DELETE /api/saved-filters/[id] (nueva) | borrar | dueño o ADMIN | id | ok |

F04 Contacto y su cuenta

| método y ruta | qué hace | quién | entrada | salida |
| --- | --- | --- | --- | --- |
| GET /api/contacts/[id] (nueva) | ficha con etiquetas y contadores: operaciones como cliente y proveedor, saldo por moneda | todos | id | contacto + contadores |
| PUT /api/contacts/[id] (cambia) | edita con control de cambios simultáneos | ADMIN, OPERATOR | campos + updatedAt | contacto o 409 |
| GET /api/accounts/[id]/transactions (cambia) | movimientos paginados con saldo acumulado | todos | page, limit | movimientos |

F05 Tablero de tesorería

| método y ruta | qué hace | quién | entrada | salida |
| --- | --- | --- | --- | --- |
| GET /api/treasury (cambia) | cajas con saldo y serie diaria de saldo para el gráfico | todos | days (máx. 90) | cajas + series |
| POST /api/treasury (existe) | movimiento manual | ADMIN, OPERATOR | sin cambios | sin cambios |
| POST /api/treasury/transfer (existe) | transferencia entre cajas | ADMIN, OPERATOR | sin cambios | sin cambios |
| GET /api/treasury/[id]/movements (existe) | movimientos de una caja | todos | sin cambios | sin cambios |

F06 Historial, notas y adjuntos

| método y ruta | qué hace | quién | entrada | salida |
| --- | --- | --- | --- | --- |
| GET /api/history (nueva) | cambios, cambios de estado, notas y adjuntos de un registro, en orden; filtro notas o cambios | todos; valores completos e IP solo ADMIN y AUDITOR | entity, entityId, kind, cursor | entradas |
| POST /api/notes (nueva) | agrega una nota interna | todos | entity, entityId, body | nota |
| PATCH /api/notes/[id] (nueva) | fijar o desfijar | autor o ADMIN | isPinned | nota |
| POST /api/attachments (nueva) | sube un archivo con el límite de Ajustes y tipos permitidos | ADMIN, OPERATOR | entity, entityId, archivo | adjunto |
| GET /api/attachments/[id] (nueva) | descarga con sesión | todos | id | archivo |

GET /api/operations/[id]/history queda reemplazada por GET /api/history.

F07 Acciones masivas y exportación

| método y ruta | qué hace | quién | entrada | salida |
| --- | --- | --- | --- | --- |
| POST /api/export (nueva) | exporta los seleccionados o el filtro actual a CSV; registra REPORT en auditoría | quien puede ver el recurso | resource, ids o consulta, fields, format | archivo |
| POST /api/archive (nueva) | archiva o desarchiva varios registros | contactos: ADMIN y OPERATOR; usuarios y monedas: ADMIN | resource, ids, archived | cantidad |

F08 Configurar el sistema

| método y ruta | qué hace | quién |
| --- | --- | --- |
| GET /api/settings (cambia) | suma restrictiveAuditTrail y timeZone | todos |
| PUT /api/settings (cambia) | idem | ADMIN |

F09 Usuarios: rutas existentes (`/api/users`, `/api/users/[id]`); solo cambia el GET.
F10 Navegar: sin rutas nuevas. El menú se arma según el rol de `/api/auth/me` y el
servidor valida cada ruta igual.
F11 Líneas embebidas: las rutas de venta distribuida actuales, sin cambio de contrato.
F12 Sesión: sin cambios.

Could (actividades y paleta de comandos)

| método y ruta | qué hace | quién |
| --- | --- | --- |
| GET /api/activities | propias o de un registro, con estado calculado | todos |
| GET /api/activities/summary | contadores Atrasadas, Hoy y Futuras para la barra superior | todos |
| POST /api/activities | programa una actividad | ADMIN, OPERATOR |
| PATCH /api/activities/[id] | marcar hecha o editar | creador, asignado o ADMIN |
| DELETE /api/activities/[id] | cancelar | creador o ADMIN |
| GET /api/search | paleta Ctrl+K: operaciones por número y contactos por nombre | todos |

Webhooks de entrada y de salida: ninguno.
Tareas programadas: limpieza diaria de sesiones vencidas (opcional).

## Lo que muerde

- Zona horaria: la base está en GMT y las fechas existentes se guardan sin zona. "Este
  mes" y agrupar por día o mes se calculan en SQL con
  `("operationDate" AT TIME ZONE 'UTC') AT TIME ZONE <timeZone de Ajustes>`.
- Totales: los importes son `Float`. Se suman en SQL por moneda y se redondean a los
  decimales de cada moneda al mostrar.
- Agrupar con nombres: Prisma agrupa por `clientId` pero no trae el nombre ni agrupa
  por mes. Va SQL propio con `Prisma.sql`, y solo con identificadores de la lista
  blanca: nada de texto del usuario dentro del SQL.
- Condiciones de carrera: los cambios de estado ya bloquean la fila. Arrastrar en el
  kanban usa ese mismo PATCH. Dos usuarios editando la misma ficha se resuelve con el
  control de `updatedAt` (409 y recargar).
- Doble envío: al crear, el cliente manda el id y la clave primaria evita el duplicado.
- Historial que se pierde: hoy, eliminar una operación borra sus comentarios, adjuntos y
  cambios de estado. Con el historial nuevo se conservan; la operación queda con `deletedAt`.
- Archivos: límite `maxAttachmentSizeMB` de Ajustes (5 MB por defecto), solo PDF e
  imágenes, guardados fuera de `public/` y servidos con sesión. Si el hosting no tiene
  disco, almacenamiento de objetos.
- Exportación CSV: escapar las celdas que empiezan con `=`, `+`, `-` o `@` para que no se
  ejecuten como fórmulas al abrirlas en Excel. Tope de 10.000 filas.
- Enlaces compartidos (could): el enlace lleva el id de un favorito compartido, nunca los
  valores del filtro, que pueden incluir nombres de clientes.
- Búsqueda: `ILIKE` con los índices nuevos alcanza con estos datos (23 operaciones). Con
  más de unas 10.000 filas, sumar índices trigram (`pg_trgm`).
- Límites de uso: exportación y búsqueda con tope de filas; el login ya tiene límite de
  intentos.
- Migraciones: la única base tiene datos reales. Probar cada migración en la base local o
  en una rama de Neon, y hacer un respaldo antes de aplicarla.
- Datos personales (Ley 25.326): el historial guarda datos de contactos. Archivar no los
  borra; ante un pedido de supresión, anonimizar.
- Permisos en la interfaz: el servidor decide. La interfaz solo oculta lo que el rol no
  puede hacer (por ejemplo, la columna "Completada" no acepta tarjetas de un OPERATOR
  que intenta reabrir).
- No aplica: tiempo real, sin conexión, correo, multiempresa.

## Orden de construcción

1. Rebanada vertical: Operaciones de punta a punta, sin pulir.
   - Pantallas: S02 (barra superior básica), S03, S04, S07, S09 (filtros y agrupar), S18 (solo lectura)
   - Tablas: índices de `AuditLog` y `Operation`; `Settings.timeZone`
   - Rutas: GET /api/operations (contrato de listas), GET /api/operations/[id], GET /api/history, PATCH existente
   - Listo cuando: buscás una operación, agrupás por estado con totales por moneda, la abrís
     en su página, la completás y ves el cambio en el historial
2. Must, por área.
   - Estructura: S01, S02 completo, menú de usuario, migas, notificaciones, diálogos,
     estados vacíos y diseño adaptable (S22). Sin rutas nuevas
   - Listas: Contactos (S03 y kanban S06), Cuentas (S04), Auditoría (S14), Usuarios
     (S16) y Monedas (S17). Rutas: GET de contactos, cuentas, movimientos, auditoría,
     usuarios y monedas
   - Formularios: ficha de contacto (S08), formulario completo de operación con pestañas y
     líneas de venta distribuida (F11), aviso de cambios sin guardar y confirmaciones.
     Rutas: GET /api/contacts/[id], POST y PUT de operaciones, PUT de contactos
   - Tesorería y Ajustes: tablero (S13) y ajustes por secciones (S15). Rutas: GET
     /api/treasury y /api/settings
   - Permisos: `can()` con la matriz confirmada, en todas las rutas
3. Should, después could.
   - Should: favoritos (`SavedFilter` y sus 4 rutas), filtros por defecto y por período,
     columnas opcionales (en el navegador), exportación (POST /api/export), archivar (POST
     /api/archive), notas (`RecordNote`), adjuntos (`Attachment`), gráfico de la tarjeta,
     bloqueo de borrado, atajos, paginador del formulario, kanban de operaciones, inicio
     con accesos, indicador de carga y separador decimal
   - Could: actividades (`Activity` y sus 5 rutas), paleta de comandos (GET /api/search),
     edición en línea y masiva, editor de filtros, arrastrar en el kanban, creación
     rápida, barras de progreso, plegar columnas, Alt+clic, enlace compartido, llave de
     acceso, importar, filtro y fijado en el historial, cinta, buscador de ajustes y
     ofrecer archivar cuando no se puede eliminar
4. Arreglos de `/replica-entrepreneur`: no aplica. Es una herramienta interna y esa skill
   no se corrió.
