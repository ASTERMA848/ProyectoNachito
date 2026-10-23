# Registro de construcción

Una línea por pantalla o tramo: fecha, estado, qué falta y qué costó más de lo previsto.
Rama `feat/interfaz-azul`. Nada subido al remoto.

| ID | pantalla | fecha | estado | falta | más difícil de lo previsto |
| --- | --- | --- | --- | --- | --- |
| — | Sistema de diseño y galería `/design` | 2026-10-22 | hecho | — | Los estilos globales viejos usan `!important` en títulos e inputs: hubo que reiniciarlos dentro de `.ui-app` |
| — | Base de datos local en Docker (puerto 5434) y datos de prueba | 2026-10-22 | hecho | — | El 5433 estaba ocupado por otro contenedor; Prisma leía `.env` (Neon) antes que el local y el script de datos tuvo que cargar el entorno primero |
| S03, S04, S05, S07 | Operaciones: lista, agrupada, kanban y formulario de venta | 2026-10-22 | hecho | Paginador entre registros, columnas opcionales, arrastrar tarjetas | Las ventas derivan su estado de las líneas: el formulario guarda por `/api/operations/distributed-sale` y las estándar por PATCH |
| S06, S08 | Contactos: tarjetas, lista, ficha | 2026-10-23 | hecho | Pestaña de contactos hijos, auditoría de cambios de etiquetas, archivar en lote con permiso por fila | El PUT viejo borra las etiquetas si no recibe `tagIds`: la ficha siempre las manda |
| S03, S04 (cuentas) | Cuentas corrientes: saldos y estado de cuenta | 2026-10-23 | hecho | Agrupar por contacto con subtotales por moneda | El saldo guardado en cada movimiento queda viejo cuando se edita una venta y sus asientos se vuelven a cargar: el saldo corrido ahora se calcula desde el saldo actual |
| S13 | Tablero de tesorería y movimientos por caja | 2026-10-23 | hecho | Filtros y búsqueda en los movimientos de una caja | La serie del gráfico se arma hacia atrás desde el saldo actual para que siempre cierre; los traspasos dejaban la caja de origen en negativo y ahora controlan el saldo como las extracciones |
| S14 | Auditoría | 2026-10-23 | hecho | Agrupar por día; bloqueo de borrado de registros auditados (función aparte) | Los `createdAt` son instantes reales: los filtros de fecha necesitaron rangos en la hora de la agencia, distintos de los de `operationDate`; las etiquetas de acciones tuvieron que salir a un módulo propio para no llevar Prisma al navegador |
| S15, S16, S17 | Ajustes, usuarios y monedas | — | pendiente | todo | — |
| S01, S02 | Inicio de sesión e inicio | — | pendiente | todo | — |

## Notas

- Solo las rutas de `NEW_UI_PATHS` (`src/components/shell/apps.ts`) usan la interfaz nueva: operaciones, contactos, cuentas corrientes, tesorería y auditoría. El resto sigue con la anterior hasta migrarse.
- Capturas para replica-diff: pendientes. El recon se hizo solo con fuentes públicas y no hay capturas de referencia en `replica/screens/`, así que no hay contra qué comparar todavía.
- `replica/schema.sql` no se aplicó: ninguna pantalla hecha hasta ahora necesitó cambiar el esquema.
- Arreglo transversal en esta tanda: las migas ya no se aplastan en formularios sin buscador (`ControlPanel` sin columna de búsqueda).
