# Calce

Sistema web para una agencia de cambio. Registra operaciones, cobros, pagos, cuentas corrientes, tesorería y auditoría. Usa Next.js 15, React 19 y Prisma con PostgreSQL 16.

## Instalación local

Requiere Node.js 22 o 24, npm y Docker Compose. Desde el repositorio:

1. Copiá `.env.example` a `.env`. En PowerShell, usá `Copy-Item .env.example .env`.
2. Definí `INITIAL_ADMIN_PASSWORD` en `.env` con al menos 12 caracteres y hasta 72 bytes. El usuario inicial se llama `admin`.
3. Ejecutá `npm ci` y `docker compose up -d --wait db`. PostgreSQL escucha en `127.0.0.1:5434`.
4. Ejecutá `npm run db:setup` y `npm run dev`. Abrí [Calce local](http://localhost:3000).

`npm run build` genera el build y `npm start` lo inicia. Las fuentes se instalan con npm y se sirven con la aplicación.

## Actualizar una base existente

Hacé un respaldo y ensayá la migración sobre una copia. Si la base ya tiene tablas creadas con `prisma db push`, compará su estructura con [la migración inicial](prisma/migrations/20261113000100_baseline/migration.sql). Una vez verificada la equivalencia, registrá la migración inicial con `npx prisma migrate resolve --applied 20261113000100_baseline` y ejecutá `npm run db:migrate`. Para una base vacía alcanza con `npm run db:setup`.

La migración monetaria convierte los importes existentes a `numeric(30,8)`, redondeando a ocho decimales. Conserva los saldos registrados y los movimientos históricos. Ejecutá [la consulta de conciliación](prisma/reconcile-balances.sql) antes y después de migrar. Revisá cada diferencia contra los comprobantes y saldos de apertura.

Si la instalación venía con la clave inicial antigua, cambiala antes de publicar. Podés definir `INITIAL_ADMIN_PASSWORD` y ejecutar `node migrate-admin-password.js` con la conexión de esa instalación. El script también cierra sus sesiones anteriores. Con un proxy de confianza, activá `TRUST_PROXY=true` solo si el proxy reemplaza `X-Real-IP` y controla el acceso directo al servidor.

## Consola SQL

Para habilitarla, ejecutá [prisma/reporting.sql](prisma/reporting.sql) en la base con una cuenta autorizada para crear el rol y las vistas. En el entorno local podés pasarle el archivo al cliente del contenedor con `Get-Content -Raw prisma/reporting.sql | docker compose exec -T db psql -U admin -d agencia_cambio -v ON_ERROR_STOP=1`.

Asigná una contraseña al rol con `\password calce_report_reader` en `psql`. Configurá `SQL_REPORTING_DATABASE_URL` con ese usuario y la misma base. Las consultas pueden leer las vistas `"Operation"`, `"Currency"`, `"Account"`, `"TreasuryAccount"` y `"TreasuryMovement"`.

## Pruebas

- `npm run lint` y `npx tsc --noEmit` validan el código.
- Para Playwright, prepará una base PostgreSQL local exclusiva para pruebas. Definí `E2E_DATABASE_URL` con esa conexión y `E2E_ADMIN_PASSWORD` con la clave de prueba. Aplicá las migraciones, cargá el seed inicial y luego `npm run db:seed-demo` contra la aplicación de pruebas. Detené ese servidor antes de ejecutar `npm run test:e2e`, que levanta su propia instancia. La prueba de consola SQL requiere configurar también la conexión de informes en esa base.
