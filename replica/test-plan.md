# Plan de pruebas: Agencia de Cambio (interfaz azul)

Build: `9e241b2` (rama `feat/interfaz-azul`)  Fecha: 2026-10-23  Entorno: local, `npm run dev` en :3000, base Docker local (puerto 5434) con `npm run db:seed-demo`.

Usuarios de prueba (solo existen en la base local, creados por `scripts/seed-demo.cjs` y `prisma/seed.js`): `admin` (ADMIN), `operador` (OPERATOR), `auditora` (AUDITOR).

Columna **auto**: `e2e` = spec de Playwright en `e2e/`; `manual` = recorrido en el navegador del panel; `n/a` = la función no está construida (queda en `features.csv`).

Todas las specs fallan si hay un error de consola o una respuesta 5xx, y pasan un análisis de accesibilidad (axe) por pantalla.

| caso | flujo | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | Crear una venta y completarla | feliz | Operaciones > Nuevo, elegir cliente, moneda, monto y cotización, Guardar; marcar cobrado y pago al proveedor | Se crea con número, el estado pasa a Completada, aparece en la lista | e2e | |
| F01-E1 | | borde: campo obligatorio vacío | Guardar sin cliente ni monto | Mensajes en los campos, no se crea nada | e2e | |
| F01-E2 | | borde: doble clic en Guardar | Dos clics seguidos en Guardar en una venta nueva | Una sola operación creada | e2e | |
| F01-E3 | | borde: salir con cambios sin guardar | Editar un campo y hacer clic en las migas | Pide confirmar antes de salir | e2e | |
| F01-E4 | | borde: texto largo, tildes y emoji | Observaciones de 2000 caracteres con tildes y emoji | Se guarda y se ve igual | e2e | |
| F01-N1 | | negativo: reabrir completada sin ser admin | Operador abre una venta completada | No puede editarla; aviso de solo administrador | e2e | |
| F01-N2 | | negativo: auditor | Auditora abre una operación | Solo lectura, sin botón Nuevo | e2e | |
| F01-N3 | | negativo: fecha antes del cierre contable | Con cierre en una fecha, cargar una operación anterior | Error claro, no se guarda | e2e | |
| F02-H1 | Buscar, filtrar y agrupar | feliz | Buscar un cliente, filtrar Pendiente, agrupar por estado | Facetas visibles, filas que coinciden, grupos con conteo | e2e | |
| F02-E1 | | borde: sin resultados | Buscar un texto que no existe | Estado vacío con "Quitar filtros" | e2e | |
| F02-E2 | | borde: O dentro del grupo, Y entre grupos | Dos estados más una fecha | El total coincide con la API | e2e | |
| F02-E3 | | borde: la URL guarda la búsqueda | Filtrar, recargar, volver atrás | Los filtros siguen aplicados | e2e | |
| F02-E4 | | borde: filtro inválido en la URL | `?filter=state:xx` | Mensaje de error, no 500 | e2e | |
| F03 | Favoritos | — | — | — | n/a | no construido |
| F04-H1 | Contacto y su cuenta | feliz | Contactos > tarjeta > botón Operaciones; Cuentas > cuenta del contacto | Lista filtrada por el contacto; estado de cuenta con saldo corrido que cierra | e2e | |
| F04-E1 | | borde: contacto archivado | Archivar, buscarlo, desarchivar | Desaparece de la lista; aparece con el filtro Archivados | e2e | |
| F04-E2 | | borde: contacto nuevo sin movimientos | Crear contacto, ver Saldos | Estado vacío en Saldos | e2e | |
| F04-N1 | | negativo: auditora edita | Auditora abre un contacto | Campos deshabilitados y aviso | e2e | |
| F05-H1 | Movimiento desde el tablero | feliz | Tesorería > Movimiento en una caja > Ingreso > Registrar | Aviso, saldo de la tarjeta sube | e2e | |
| F05-E1 | | borde: importe inválido | Importe vacío, 0 y texto | Error en el campo, no se registra | e2e | |
| F05-E2 | | borde: extracción mayor al saldo | Extraer más de lo que hay | Error, el saldo no cambia | e2e | |
| F05-E3 | | borde: cancelar el diálogo | Abrir y Cancelar | Nada cambia | e2e | |
| F05-N1 | | negativo: auditora | Auditora en Tesorería | Sin botones de movimiento; la API responde 403 | e2e | |
| F06 | Notas y adjuntos | — | — | El historial se ve; notas y adjuntos no están en la interfaz nueva | n/a | no construido |
| F07-H1 | Acciones masivas | feliz | Seleccionar filas > Acciones > Exportar a CSV | Se descarga un CSV con esas filas | e2e | |
| F07-E1 | | borde: celda que empieza con = | Contacto llamado `=1+1`, exportar | La celda sale como texto | e2e | |
| F08-H1 | Configurar el sistema | feliz | Cambiar cierre contable, Guardar | Aviso y registro en auditoría | e2e | |
| F08-E1 | | borde: descartar | Cambiar y Descartar | Vuelve al valor guardado | e2e | |
| F08-N1 | | negativo: operador | Operador en Configuración | General deshabilitado; la API responde 403 | e2e | |
| F09-H1 | Administrar usuarios | feliz | Usuarios > Nuevo > datos > Guardar; Pausar | Usuario creado; pausado no puede entrar | e2e | |
| F09-E1 | | borde: contraseña débil | Contraseña de 3 caracteres | Error en el campo | e2e | |
| F09-E2 | | borde: pausarse a uno mismo | Seleccionarse y Pausar | No lo permite | e2e | |
| F09-N1 | | negativo: operador en la API | POST /api/users como operador | 403 | e2e | |
| F10-H1 | Navegar y volver | feliz | Inicio > app > sección > registro > migas | Cada paso abre lo correcto | e2e | |
| F10-E1 | | borde: rutas por rol | Auditora abre /operations/new y /settings/users/new | No puede crear | e2e | |
| F10-E2 | | borde: ancho de teléfono | Cada pantalla a 390 px | Sin scroll horizontal de página | e2e | |
| F11-H1 | Líneas de una venta distribuida | feliz | Nueva venta distribuida, agregar 2 líneas, Guardar | Totales recalculados, se guarda con 2 líneas | e2e | |
| F11-E1 | | borde: borrar una línea | Quitar una línea y guardar | Queda una línea, total actualizado | e2e | |
| F11-E2 | | borde: línea inválida | Línea sin monto | Error en la línea | e2e | |
| F12-H1 | Iniciar y cerrar sesión | feliz | Login, menú de usuario > Cerrar sesión | Entra a Inicio; al salir vuelve al login | e2e | |
| F12-N1 | | negativo: contraseña incorrecta | Usuario válido, clave mala | Mensaje genérico, sin pistas | e2e | |
| F12-E1 | | borde: sesión vencida y vuelta | Abrir una pantalla sin sesión | Login y luego vuelve a la pantalla pedida | e2e | |
| F12-E2 | | borde: redirección externa | `/login?next=//otro-sitio.test` | Después de entrar queda en Inicio | e2e | |
| F12-E3 | | borde: usuario pausado | Pausado intenta entrar | Mismo mensaje genérico | e2e | |
| X-1 | Seguridad transversal | negativo | Llamadas a la API sin sesión y con rol sin permiso para cada escritura | 401 o 403, nunca 200 | e2e | |
| X-2 | | negativo: consola SQL | Auditora intenta leer User o Session, y una escritura | Bloqueado | e2e | |
