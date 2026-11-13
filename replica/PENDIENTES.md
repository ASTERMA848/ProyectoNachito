# Pendientes para retomar

Estado al 2026-11-13. Rama `feat/interfaz-azul`. **Nada subido al remoto.**

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
- Pruebas: `npm run test:e2e` (67 pruebas, todas pasan). Usa el Chrome instalado; `E2E_CHANNEL` permite cambiarlo.
- Rendimiento de listas a escala: `npm run test:list-scale` (siembra y borra datos de prueba solos, no toca `test:e2e`).
- Los contenedores `odoo-ee-web-1` y `odoo-ee-db-1` son de otro proyecto: no se tocaron.

## Errores abiertos

Ninguno. BUG-004 (búsqueda con tildes) y BUG-007 (grupos con filtros del mismo campo) quedaron corregidos el 2026-11-13. Detalle en `replica/bugs.md`.

## Antes de producción

- **Límite de intentos de login:** usa el encabezado `x-forwarded-for`. En Vercel es seguro; en un servidor propio sin proxy se puede saltear. Confirmar dónde corre producción.
- **El límite vive en memoria:** con varias instancias conviene moverlo a Redis o a la base.
- **`Transaction.balance` (saldo guardado por movimiento):** queda viejo cuando se edita una venta. Las pantallas calculan el saldo corrido; decidir si se recalcula la columna o se deja de usar.
- **Borrar una moneda:** la contraseña del administrador se pide solo en la pantalla, no en la API.
- **Esquema:** `replica/schema.sql` no se aplicó; ninguna pantalla lo necesitó todavía.
- **Producción usa la interfaz nueva en cuanto se integre la rama:** las pantallas viejas de esas rutas quedan reemplazadas.

## Funciones que faltan

Fuente: `replica/features.csv`. **Imprescindibles: 42 de 42. Paridad de funciones: 80,2 / 100 — por encima del umbral de 80 del método.** El clon es "shippable". Detalle en `replica/parity.md`.

### Convenientes

Bloquear el borrado de registros auditados, favoritos de búsqueda, filtros por período con flechas, separador decimal con punto o coma, notas internas y adjuntos, columnas opcionales, atajos de teclado y exportar eligiendo campos (y en XLSX).

### Opcionales

Paleta de comandos (Ctrl+K), arrastrar tarjetas, creación rápida en kanban, plegar columnas, edición en línea y masiva, importar desde archivo, cinta de archivado o cancelado, actividades programadas, filtro y mensajes fijados en el historial, buscador de ajustes, llave de acceso, enlace para compartir una vista, y pasar la consola SQL y el manual a la interfaz nueva.

## Siguientes pasos del método

1. Hecho el 2026-11-13: `/replica-diff`. Paridad de funciones 70,3 / 100; 34 de 42 imprescindibles. Detalle y las cinco prioridades en `replica/parity.md`. Las capturas del clon están en `replica/clone-screens/`; faltan las del original para medir el diseño.
2. Hecho el 2026-11-13: `/replica-build` de las 8 imprescindibles, y después las 2 convenientes que faltaban para pasar de 80. Paridad final: 80,2 con 42 de 42 imprescindibles. **El clon es publicable según el método** (`replica/parity.md`).
3. Hecho el 2026-11-13: `/replica-entrepreneur`. 32 reseñas reales de Odoo (Software Advice, Hacker News, TrustRadius — G2 y Capterra bloquearon el acceso; Reddit no es accesible en este entorno) en `replica/reviews.csv`, rankeadas en `replica/feedback.md`. Las tres listas, el plan de arreglos y el ángulo de posicionamiento quedaron en `replica/fixes.md`; 5 filas nuevas en `features.csv` con `original=no` (diferenciadores, no paridad). Ángulo elegido: "una sola cosa, bien hecha" en vez de un ERP genérico.
4. Hecho el 2026-11-13: `/replica-brand`. Nombre elegido: **Calce** (de 5 finalistas limpios tras descartar 3 por colisión real — ver `replica/brand.md`). Aplicado en el login y en el título de la pestaña. Paleta ya era propia (violeta de Odoo reemplazado por azul en `/replica-design`); contraste confirmado, 0 fallas AA. Barrido (`sweep.py`) limpio: nada del nombre, dominio ni colores de Odoo en el repo. Falta: encargar el logo con el brief de `replica/brand.md` (el favicon sigue siendo el genérico de Next.js) y, solo si esta web deja de ser de uso interno, correr en serio los controles de marca (están marcados "a correr", empezando por el INPI).
5. Hecho el 2026-11-13: las 5 primeras filas del plan de arreglos de `/replica-entrepreneur` (`replica/fixes.md`, sección "Plan de arreglos"). Detalle abajo, en "Diferenciadores". Quedan 2 filas más (6 y 7) sin construir, ninguna bloquea publicar. El método seguiría con `/replica-launch`, que no aplica tal cual porque esta web no se vende ni se lanza.

## Diferenciadores sobre el original (de `/replica-entrepreneur`)

Detalle y evidencia en `replica/fixes.md`.

Hechas el 2026-11-13 (filas 1 a 5 del plan de arreglos):

- Aviso de contacto duplicado al crear o editar, sin bloquear el guardado (`src/app/contacts/ContactForm.tsx`, `/api/contacts/check-duplicate`).
- Prueba de concurrencia en la numeración de operaciones: 12 ventas simultáneas, sin números repetidos ni huecos (`e2e/x-numbering-concurrency.spec.ts`, X-7).
- Recorrido de primeros pasos en el inicio, con cada marca verificada contra la base (`/api/onboarding`, `src/app/HomeLauncher.tsx`); desaparece solo cuando ya está todo hecho. La auditora ve una guía de referencia sin marcas. Cubierto por `e2e/x-onboarding-checklist.spec.ts` (X-8, X-9, X-10).
- Historial inline junto a la cotización, sin abrir el historial completo (`RecordHistory.tsx`'s `FieldChangeNote`, en `StandardForm.tsx` y `SaleForm.tsx`). De paso se corrigió un bug real: el audit log de la edición de operaciones no guardaba `exchangeRate` ni campos simétricos, así que el historial casi nunca decía qué había cambiado.
- Rendimiento de listas verificado a escala real: `npm run test:list-scale` (`scripts/list-scale-check.cjs`) siembra 5000 operaciones de prueba en la base local, mide `/api/operations` a través del servidor real con y sin texto de búsqueda, y confirma que sigue paginando (nunca devuelve más de `limit` filas) y respondiendo rápido (~50-75ms, muy por debajo de los 1500ms de margen) aunque la base crezca. Limpia los datos de prueba al terminar.

Pendientes de construir (filas 6 y 7, ninguna bloquea publicar):

- Terminar la consola SQL y el manual con el mismo sistema de diseño (ya estaba pendiente; reforzado por la investigación) (M).
- Ayuda en el campo de cotización multimoneda (S).

## Documentos relacionados

- `replica/recon.md`, `replica/architecture.md`, `replica/design/`: mapa, arquitectura y sistema de diseño.
- `replica/reviews.csv`, `replica/feedback.md`, `replica/fixes.md`: investigación de usuarios de Odoo, ranking y plan de arreglos.
- `replica/build-log.md`: qué se hizo en cada pantalla y qué costó.
- `replica/test-plan.md` y `replica/bugs.md`: casos probados, resultados y errores.
