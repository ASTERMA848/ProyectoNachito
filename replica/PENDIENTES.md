# Pendientes para retomar

Estado al 2026-10-23. Rama `feat/interfaz-azul` (último commit `9fed2ac`). **Nada subido al remoto.**

## Estado del repositorio

- `feat/interfaz-azul`: toda la interfaz nueva, las pruebas y los arreglos. No está integrada en `main`.
- `main`: tiene el arreglo de la consola SQL y de las operaciones (`7c3ac98`), un commit por delante de `origin/main`. **No se subió.**
- `.claude/launch.json` (configuración del servidor de vista previa) quedó sin confirmar a propósito: es de la máquina, no del proyecto.

Para retomar hay que decidir:

1. Subir `main` (`git push origin main`), si el arreglo de la consola SQL ya está revisado.
2. Integrar `feat/interfaz-azul` en `main` (fusión o PR) cuando la interfaz nueva esté aprobada.
3. Antes de publicar, correr la suite contra la base local y revisar la sección "Antes de producción".

## Cómo levantar el entorno local

- Base de desarrollo: contenedor Docker `nachito-dev-db` (PostgreSQL en `localhost:5434`), sin arranque automático. Si está apagado: `docker start nachito-dev-db`.
- `.env.development.local` (no se versiona) apunta a esa base. **No usar `.env` (Neon) para desarrollo ni pruebas.**
- Servidor: `npm run dev` (puerto 3000).
- Datos de prueba: `npm run db:seed-demo` (se niega a correr contra una base que no sea la local). Usuarios: `admin`, `operador` y `auditora`; las contraseñas están en `prisma/seed.js` y `scripts/seed-demo.cjs`.
- Pruebas: `npm run test:e2e` (47 pruebas, todas pasan). Usa el Chrome instalado; `E2E_CHANNEL` permite cambiarlo.
- Los contenedores `odoo-ee-web-1` y `odoo-ee-db-1` son de otro proyecto: no se tocaron.

## Errores abiertos

- **BUG-004 (S3): la búsqueda distingue tildes.** "benitez" no encuentra a Benítez. La solución es la extensión `unaccent` de PostgreSQL (o columnas normalizadas) con consultas SQL propias en `src/lib/resources/*`. Es un cambio de esquema: probarlo en la base local y en una copia de Neon antes de aplicarlo en producción. Detalle en `replica/bugs.md`.

## Antes de producción

- **Límite de intentos de login:** usa el encabezado `x-forwarded-for`. En Vercel es seguro; en un servidor propio sin proxy se puede saltear. Confirmar dónde corre producción.
- **El límite vive en memoria:** con varias instancias conviene moverlo a Redis o a la base.
- **`Transaction.balance` (saldo guardado por movimiento):** queda viejo cuando se edita una venta. Las pantallas calculan el saldo corrido; decidir si se recalcula la columna o se deja de usar.
- **Borrar una moneda:** la contraseña del administrador se pide solo en la pantalla, no en la API.
- **Esquema:** `replica/schema.sql` no se aplicó; ninguna pantalla lo necesitó todavía.
- **Producción usa la interfaz nueva en cuanto se integre la rama:** las pantallas viejas de esas rutas quedan reemplazadas.

## Funciones que faltan

Fuente: `replica/features.csv` (columna `clone`). Imprescindibles: 34 de 42 hechas y 7 a medias.

### Imprescindibles (must)

- **Selector de contacto con autocompletar y crear** (falta): hoy se elige de una lista desplegable.
- **Menú de usuario** (a medias): falta un perfil propio; hoy lleva a Configuración.
- **Buscador con sugerencias por campo** (a medias): hoy es texto libre en varios campos.
- **Agrupar por varios campos** (a medias): hoy un solo nivel.
- **Campos de importe con símbolo** (a medias): se muestra el código de moneda, sin selector integrado.
- **Historial por registro** (a medias): está en operaciones y contactos; faltan los demás.
- **Cuentas agrupadas por contacto con subtotales por moneda** (a medias): hoy se agrupa por moneda o por situación.
- **Kanban por defecto en el teléfono** (a medias): contactos sí; operaciones abre en lista.

### Convenientes (should)

- Favoritos de búsqueda (predeterminado y compartido).
- Filtros por defecto al abrir una vista.
- Filtros por período con flechas.
- Columnas opcionales por usuario.
- Exportar eligiendo campos, y en XLSX.
- Paginador entre registros dentro del formulario.
- Notas internas y adjuntos en la interfaz nueva (antes estaban en operaciones).
- Bloquear el borrado de registros auditados (hoy se puede eliminar una operación).
- Atajos de teclado con superposición al mantener Alt.
- Separador decimal con punto o coma.
- Verificar el tema oscuro en todas las pantallas nuevas.

### Opcionales (could)

Paleta de comandos (Ctrl+K), arrastrar tarjetas entre columnas, creación rápida en kanban, barra de progreso y plegado de columnas, edición en línea y masiva, importar desde archivo, cinta de archivado o cancelado, actividades programadas, filtro y mensajes fijados en el historial, buscador de ajustes, llave de acceso, enlace para compartir una vista, y pasar la consola SQL y el manual a la interfaz nueva.

## Siguientes pasos del método

1. Hecho el 2026-11-13: `/replica-diff`. Paridad de funciones 70,3 / 100; 34 de 42 imprescindibles. Detalle y las cinco prioridades en `replica/parity.md`. Las capturas del clon están en `replica/clone-screens/`; faltan las del original para medir el diseño.
2. `/replica-build` para las 8 imprescindibles que faltan (orden en `replica/parity.md`).
3. Después, `/replica-entrepreneur`, `/replica-brand` (nombre y marca propios; correr la búsqueda de restos del original) y recién ahí el lanzamiento.

## Documentos relacionados

- `replica/recon.md`, `replica/architecture.md`, `replica/design/`: mapa, arquitectura y sistema de diseño.
- `replica/build-log.md`: qué se hizo en cada pantalla y qué costó.
- `replica/test-plan.md` y `replica/bugs.md`: casos probados, resultados y errores.
