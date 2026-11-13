# Plan de pruebas: Agencia de Cambio (interfaz azul)

Build: `9e241b2` (rama `feat/interfaz-azul`); última corrida el 2026-11-13, después de la segunda tanda de imprescindibles: 58 pruebas, 58 pasan  Fecha: 2026-10-23  Entorno: local, `npm run dev` en :3000, base Docker local (puerto 5434) con `npm run db:seed-demo`.

Usuarios de prueba (solo existen en la base local, creados por `scripts/seed-demo.cjs` y `prisma/seed.js`): `admin` (ADMIN), `operador` (OPERATOR), `auditora` (AUDITOR).

Columna **auto**: `e2e` = spec de Playwright en `e2e/`; `manual` = recorrido en el navegador del panel; `n/a` = la función no está construida (queda en `features.csv`).

Todas las specs fallan si hay un error de consola o una respuesta 5xx, y pasan un análisis de accesibilidad (axe) por pantalla.

| caso | flujo | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | Crear una venta y completarla | feliz | Operaciones > Nuevo, elegir cliente, moneda, monto y cotización, Guardar; marcar cobrado y pago al proveedor | Se crea con número, el estado pasa a Completada, aparece en la lista | e2e | pasa |
| F01-E1 | | borde: campo obligatorio vacío | Guardar sin cliente ni monto | Mensajes en los campos, no se crea nada | e2e | pasa |
| F01-E2 | | borde: doble clic en Guardar | Dos clics seguidos en Guardar en una venta nueva | Una sola operación creada | e2e | pasa |
| F01-E3 | | borde: salir con cambios sin guardar | Editar un campo y hacer clic en las migas | Pide confirmar antes de salir | e2e | pasa |
| F01-E4 | | borde: texto largo, tildes y emoji | Observaciones de 2000 caracteres con tildes y emoji | Se guarda y se ve igual | e2e | pasa (con F01-E2) |
| F01-N1 | | negativo: reabrir completada sin ser admin | Operador abre una venta completada | No puede editarla; aviso de solo administrador | e2e | pasa |
| F01-N2 | | negativo: auditor | Auditora abre una operación | Solo lectura, sin botón Nuevo | e2e | pasa |
| F01-N3 | | negativo: fecha antes del cierre contable | Con cierre en una fecha, cargar una operación anterior | Error claro, no se guarda | e2e | pasa |
| F02-H1 | Buscar, filtrar y agrupar | feliz | Buscar un cliente, filtrar Pendiente, agrupar por estado | Facetas visibles, filas que coinciden, grupos con conteo | e2e | pasa |
| F02-E1 | | borde: sin resultados | Buscar un texto que no existe | Estado vacío con "Quitar filtros" | e2e | pasa |
| F02-E2 | | borde: O dentro del grupo, Y entre grupos | Dos estados más una fecha | El total coincide con la API | e2e | pasa |
| F02-E3 | | borde: la URL guarda la búsqueda | Filtrar, recargar, volver atrás | Los filtros siguen aplicados | e2e | pasa |
| F02-E4 | | borde: filtro inválido en la URL | `?filter=state:xx` | Mensaje de error, no 500 | e2e | pasa |
| F03 | Favoritos | — | — | — | n/a | no construido |
| F04-H1 | Contacto y su cuenta | feliz | Contactos > tarjeta > botón Operaciones; Cuentas > cuenta del contacto | Lista filtrada por el contacto; estado de cuenta con saldo corrido que cierra | e2e | pasa |
| F04-E1 | | borde: contacto archivado | Archivar, buscarlo, desarchivar | Desaparece de la lista; aparece con el filtro Archivados | e2e | pasa |
| F04-E2 | | borde: contacto nuevo sin movimientos | Crear contacto, ver Saldos | Estado vacío en Saldos | e2e | pasa |
| F04-N1 | | negativo: auditora edita | Auditora abre un contacto | Campos deshabilitados y aviso | e2e | pasa |
| F05-H1 | Movimiento desde el tablero | feliz | Tesorería > Movimiento en una caja > Ingreso > Registrar | Aviso, saldo de la tarjeta sube | e2e | pasa |
| F05-E1 | | borde: importe inválido | Importe vacío, 0 y texto | Error en el campo, no se registra | e2e | pasa |
| F05-E2 | | borde: extracción mayor al saldo | Extraer más de lo que hay | Error, el saldo no cambia | e2e | pasa |
| F05-E3 | | borde: cancelar el diálogo | Abrir y Cancelar | Nada cambia | e2e | pasa (con F05-E1) |
| F05-N1 | | negativo: auditora | Auditora en Tesorería | Sin botones de movimiento; la API responde 403 | e2e | pasa |
| F06 | Notas y adjuntos | — | — | El historial se ve; notas y adjuntos no están en la interfaz nueva | n/a | no construido |
| F07-H1 | Acciones masivas | feliz | Seleccionar filas > Acciones > Exportar a CSV | Se descarga un CSV con esas filas | e2e | pasa |
| F07-E1 | | borde: celda que empieza con = | Contacto llamado `=1+1`, exportar | La celda sale como texto | e2e | pasa |
| F08-H1 | Configurar el sistema | feliz | Cambiar cierre contable, Guardar | Aviso y registro en auditoría | e2e | pasa |
| F08-E1 | | borde: descartar | Cambiar y Descartar | Vuelve al valor guardado | e2e | pasa |
| F08-N1 | | negativo: operador | Operador en Configuración | General deshabilitado; la API responde 403 | e2e | pasa |
| F09-H1 | Administrar usuarios | feliz | Usuarios > Nuevo > datos > Guardar; Pausar | Usuario creado; pausado no puede entrar | e2e | pasa |
| F09-E1 | | borde: contraseña débil | Contraseña de 3 caracteres | Error en el campo | e2e | pasa |
| F09-E2 | | borde: pausarse a uno mismo | Seleccionarse y Pausar | No lo permite | e2e | pasa |
| F09-N1 | | negativo: operador en la API | POST /api/users como operador | 403 | e2e | pasa (con F08-N1) |
| F10-H1 | Navegar y volver | feliz | Inicio > app > sección > registro > migas | Cada paso abre lo correcto | e2e | pasa |
| F10-E1 | | borde: rutas por rol | Auditora abre /operations/new y /settings/users/new | No puede crear | e2e | pasa |
| F10-E2 | | borde: ancho de teléfono | Cada pantalla a 390 px | Sin scroll horizontal de página | e2e | pasa |
| F11-H1 | Líneas de una venta distribuida | feliz | Nueva venta distribuida, agregar 2 líneas, Guardar | Totales recalculados, se guarda con 2 líneas | e2e | pasa |
| F11-E1 | | borde: borrar una línea | Quitar una línea y guardar | Queda una línea, total actualizado | e2e | pasa |
| F11-E2 | | borde: línea inválida | Línea sin monto | Error en la línea | e2e | pasa |
| F12-H1 | Iniciar y cerrar sesión | feliz | Login, menú de usuario > Cerrar sesión | Entra a Inicio; al salir vuelve al login | e2e | pasa |
| F12-N1 | | negativo: contraseña incorrecta | Usuario válido, clave mala | Mensaje genérico, sin pistas | e2e | pasa |
| F12-E1 | | borde: sesión vencida y vuelta | Abrir una pantalla sin sesión | Login y luego vuelve a la pantalla pedida | e2e | pasa |
| F12-E2 | | borde: redirección externa | `/login?next=//otro-sitio.test` | Después de entrar queda en Inicio | e2e | pasa |
| F12-E3 | | borde: usuario pausado | Pausado intenta entrar | Mismo mensaje genérico | e2e | pasa |
| X-1 | Seguridad transversal | negativo | Llamadas a la API sin sesión y con rol sin permiso para cada escritura | 401 o 403, nunca 200 | e2e | pasa |
| X-2 | | negativo: consola SQL | Auditora intenta leer User o Session, y una escritura | Bloqueado | e2e | pasa |
| F02-E5 | | borde: apellido y nombre completo | Buscar "Benítez" y "Carlos Benítez" | Mismo total que con "Carlos" | e2e | falló: BUG-003, corregido |
| F04-E3 | | borde: nombre de 200 caracteres | Crear contacto con nombre largo y buscarlo | Sin scroll horizontal | e2e | pasa |
| F04-E4 | | borde: API sin etiquetas | PUT de un contacto sin `tagIds` | Conserva sus etiquetas | e2e | falló: BUG-005, corregido |
| F05-E4 | | borde: dos traspasos simultáneos | Dos traspasos a la vez por el 60 % del saldo | Uno pasa, el otro 409; la caja no queda negativa | e2e | pasa |
| F10-E4 | | borde: formulario nuevo a 1440 px | Nueva venta | La hoja usa todo el ancho | e2e | falló: BUG-006, corregido |
| X-3 | | negativo: operador en auditoría y SQL | GET /api/audit y POST /api/sql | 403 | e2e | pasa |
| X-4 | | negativo: reabrir un traspaso | PATCH a Pendiente y a Completada | Rechazado; saldos sin cambios | e2e | falló: BUG-001, corregido |
| X-5 | | negativo: ficha de un traspaso | Abrir la operación de un traspaso | Sin Reabrir; dice "Traspaso entre cajas" | e2e | falló: BUG-001, corregido |
| X-6 | | borde: agrupar por tipo | Agrupar por tipo y abrir cada grupo | Nombres legibles; cada grupo trae sus filas | e2e | falló: BUG-002, corregido |
| F01-E5 | | borde: selector de contactos | Buscar "benitez" sin tilde, Escape, y crear un proveedor desde el campo | Encuentra a Benítez; crea y elige al proveedor | e2e | pasa |
| F02-E6 | | borde: buscar en un campo | Escribir, elegir "Buscar Cliente" con flechas y Enter, quitar la faceta | Faceta "Cliente: …" y el total de la API | e2e | pasa |
| F02-E7 | | borde: tildes y comodines | "benitez", "BENITEZ", "perez" y "%" | Mismo resultado que con tildes; "%" no encuentra nada | e2e | falló: BUG-004, corregido |
| F02-E8 | | borde: agrupar por dos campos | Estado y después cliente; abrir grupo y subgrupo | Subgrupos que suman el grupo; filas del subgrupo | e2e | pasa |
| F02-E9 | | borde: grupo con filtro de varios valores | Filtro Pendiente o Completada, agrupar por estado, abrir Completada | Solo las completadas | e2e | falló: BUG-007, corregido |
| M-1 | Imprescindibles | feliz: perfil | Menú de usuario > Mi perfil | Página propia con los datos del usuario | e2e | pasa |
| M-2 | | borde: teléfono | Operaciones a 390 px | Abre en kanban | e2e | pasa |
| M-3 | | feliz: cuentas por contacto | Agrupar por contacto | Un subtotal por moneda y las filas del contacto | e2e | pasa |
| M-4 | | feliz: saldos enlazados | Ficha del contacto > Saldos > una moneda | Abre su estado de cuenta | e2e | pasa |
| M-5 | | feliz: historial en más fichas | Cuenta, caja, usuario y moneda | Cada una muestra sus cambios | e2e | pasa |
| M-6 | | negativo: historial de otro usuario | Operador pide el historial de otro usuario | 403 | e2e | pasa |
