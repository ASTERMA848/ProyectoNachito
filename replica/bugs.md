# Errores encontrados

Corrida: 2026-10-23, rama `feat/interfaz-azul`, servidor local `npm run dev`, base Docker local con datos de prueba, Chrome 1440 px (y 390 px donde se indica). Suite: `npm run test:e2e`.

Resumen: 7 errores reproducidos (1 S1, 5 S3, 1 S4), todos corregidos con su prueba. Ninguno abierto.

### BUG-001: reabrir un traspaso de tesorería hace desaparecer el dinero

- Severity: S1
- Flow / case: F05, X-4
- Screen: S07 (ficha de la operación de tesorería)
- Build: `9e241b2`  Browser / device: Chrome, 1440px

Steps
1. Tesorería: traspasar 1 USD de Caja dólares a Billetera USDT (queda la operación TREASURY_TRANSFER, Completada).
2. Abrir la operación desde Operaciones: aparece como "Operación estándar" con el botón Reabrir.
3. Reabrir (estado Pendiente) y volver a Completar (`PATCH /api/operations/:id` con `state`).

Expected: o no se puede reabrir, o los saldos quedan como estaban.
Actual: al reabrir se revierten los dos movimientos de caja; al completar no se vuelven a cargar (la operación no tiene cliente ni proveedor). La operación dice "Completada" pero Caja dólares pasó de 39.898 a 39.899 y Billetera USDT de 3.502 a 3.501, y la ficha muestra 0 movimientos de caja.
Evidence: prueba `x-treasury-operations.spec.ts › X-4`; diferencia de saldos en la corrida fallida.
Suspected cause: el PATCH trata a las operaciones de tesorería como estándar: `reverseSaleLedger` borra sus movimientos y `applyOperationLedger` solo recarga los de cliente y proveedor.
Status: fixed in `9f1b0c4`. Las operaciones de tesorería ya no se reabren ni se editan (400 con explicación); la ficha es de solo lectura y dice qué son. Eliminar sigue disponible para el administrador y revierte la caja. Se borraron 3 operaciones de prueba que habían quedado así en la base local.

### BUG-002: agrupar por tipo muestra códigos y abre las filas equivocadas

- Severity: S3
- Flow / case: F02, X-6
- Screen: S04 (lista agrupada de operaciones)
- Build: `9e241b2`

Steps
1. Operaciones > Agrupar por > Tipo.
2. Abrir el grupo "TREASURY_TRANSFER".

Expected: el grupo se llama "Traspaso entre cajas" y muestra los traspasos.
Actual: los grupos de tesorería se llaman TREASURY_INCOME y TREASURY_TRANSFER, y su filtro es `type:standard`: al abrirlos se ven las operaciones estándar (3 filas en vez de 1 o 3).
Evidence: `GET /api/operations?groupBy=type` devolvía `{label: "TREASURY_INCOME", filter: "type:standard"}`; prueba `X-6`.
Status: fixed in `9f1b0c4`. Nombres para los tres tipos de tesorería, filtro propio por tipo y un filtro "Tesorería" que los junta.

### BUG-003: la búsqueda no encuentra por apellido ni por nombre completo

- Severity: S3
- Flow / case: F02-E5
- Screen: S03 (operaciones), S06 (contactos), cuentas corrientes
- Build: `9e241b2`

Steps
1. Operaciones: buscar "Benítez" (cliente Carlos Benítez, cargado con nombre "Carlos" y apellido "Benítez").
2. Buscar "Carlos Benítez".

Expected: las 6 operaciones del cliente en los dos casos.
Actual: 0 resultados en los dos (con "Carlos" aparecen 6). En contactos y cuentas, "Carlos Benítez" tampoco encontraba nada porque ningún campo tiene las dos palabras.
Evidence: prueba `f02-search.spec.ts › F02-E5`.
Status: fixed in `9f1b0c4`. La búsqueda de operaciones mira también el apellido, y en las tres listas cada palabra tiene que aparecer en algún campo.

### BUG-004: la búsqueda distingue tildes

- Severity: S3
- Flow / case: F02
- Screen: S03, S06, cuentas corrientes, auditoría
- Build: `9f1b0c4`

Steps
1. Contactos: buscar "benitez" (sin tilde).

Expected: aparece Carlos Benítez.
Actual: 0 resultados; con "Benítez" aparece.
Evidence: `GET /api/contacts?q=benitez` → total 0; `q=Benítez` → total 1.
Suspected cause: `contains` con `mode: "insensitive"` usa ILIKE, que ignora mayúsculas pero no tildes.
Status: fixed in `c4be778`. Se resolvió sin extensiones ni cambios de esquema: las búsquedas de operaciones, contactos y cuentas comparan con `translate(lower(...))` de PostgreSQL, que existe igual en Neon. Los comodines `%` y `_` se buscan como texto. Prueba `F02-E7`.

### BUG-005: editar un contacto por la API sin etiquetas se las borra

- Severity: S3
- Flow / case: F04-E4
- Screen: API `PUT /api/contacts/:id`
- Build: `9e241b2`

Steps
1. Crear un contacto con una etiqueta.
2. `PUT /api/contacts/:id` con nombre y rol, sin `tagIds`.

Expected: el contacto conserva su etiqueta.
Actual: queda sin etiquetas. La ficha nueva no lo dispara (siempre manda las etiquetas), pero cualquier otro cliente de la API sí.
Evidence: prueba `F04-E4`.
Status: fixed in `9f1b0c4`. Las etiquetas se reemplazan solo si vienen en el pedido.

### BUG-006: un formulario nuevo deja una franja vacía a la derecha

- Severity: S4
- Flow / case: F10-E4
- Screen: S07 nuevo (venta, contacto, usuario)
- Build: `9e241b2`  Browser / device: Chrome, 1440px

Steps
1. Operaciones > Nuevo > Venta 1 a 1 en una pantalla de 1400 px o más.

Expected: la hoja y la barra de acciones usan todo el ancho.
Actual: se reserva la columna del historial aunque un registro nuevo no tiene historial; la barra termina a 1020 px y el resto queda gris.
Evidence: captura de la prueba F11 en la primera corrida; prueba `F10-E4`.
Status: fixed in `9f1b0c4`.

### BUG-007: un grupo trae filas de otros valores del mismo campo

- Severity: S3
- Flow / case: F02-E9
- Screen: S04 (lista agrupada), S05 (kanban)
- Build: `4b0e9b6`

Steps
1. Operaciones con el filtro "Pendiente o Completada" (`filter=state:pending&filter=state:completed`) y agrupar por estado.
2. Abrir el grupo "Pendiente".

Expected: las 17 operaciones pendientes que dice el grupo.
Actual: 44 filas: también las completadas. El filtro del grupo se sumaba a los del usuario y los filtros de un mismo campo se combinan con O. Lo mismo pasaba en las columnas del kanban, en cuentas corrientes y en auditoría.
Evidence: `GET /api/operations?filter=state:pending&filter=state:completed&filter=state:pending` → total 44 con el grupo en 17; prueba `F02-E9`.
Status: fixed in `055cad2`. El filtro de un grupo reemplaza a los del usuario en ese mismo campo (`withGroupFilters`).

## Para revisar (no reproducido como error)

- **Límite de intentos de login y `x-forwarded-for`.** El límite de 5 intentos cada 15 minutos usa la dirección que manda el encabezado `x-forwarded-for`. En Vercel ese encabezado lo pone la plataforma y no se puede falsificar; si la web se sirve sin un proxy que lo reescriba, cualquiera puede cambiarlo en cada intento y saltear el límite (las pruebas lo hacen a propósito para no bloquearse). Confirmar dónde corre producción.
- **El límite vive en memoria.** Con más de una instancia o después de reiniciar, se reinicia la cuenta. El propio código ya lo anota.
- **Saldo guardado en cada movimiento de cuenta.** La columna `Transaction.balance` queda vieja cuando se edita una venta y sus asientos se vuelven a cargar. Las pantallas ya no la usan (calculan el saldo corrido), pero sí la ve quien consulte la tabla por la consola SQL.
- **Contraseña al eliminar una moneda.** Se pide solo en la pantalla; la API no la vuelve a verificar. Solo el administrador puede llamar a esa API.
- **Descarga de CSV.** El enlace temporal se revocaba en el mismo instante del clic, algo que algunos navegadores cancelan. No se reprodujo en Chrome; se cambió igual a revocarlo un minuto después.
- **Herramientas de esta máquina.** El Chromium que descarga Playwright no arranca (error de configuración en paralelo de Windows) y Edge se cierra después de una descarga cuando lo maneja Playwright: la suite usa el Chrome instalado (`E2E_CHANNEL` permite cambiarlo).

## No probado

- F03 favoritos y F06 notas y adjuntos: no están construidos en la interfaz nueva.
- Consola SQL y Manual con su pantalla (siguen con la interfaz anterior); la consola sí se probó por la API (X-2).
- Red lenta, sin conexión y dos pestañas editando el mismo registro.
- Lector de pantalla real: solo el análisis automático de axe (sin violaciones graves ni críticas en las 10 pantallas principales y los formularios).
