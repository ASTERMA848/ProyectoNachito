// Imprescindible #5 de replica-entrepreneur (replica/fixes.md): el contrato de listas ya pagina
// en el servidor (skip/take en listOperations); lo que faltaba era medirlo con una base grande.
// Este script agrega miles de operaciones de prueba, mide /api/operations a través del servidor
// real (el mismo camino que usa el buscador al tipear) y borra todo lo que creó al terminar.
//
// Usar la misma base local que el servidor y las sesiones de Playwright.
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const envPath = path.join(__dirname, "..", ".env.development.local");
const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL\s*=\s*(.*)$/m)?.[1] : null;
const databaseUrl = process.env.E2E_DATABASE_URL ?? raw?.trim().replace(/^["']|["']$/g, "");
const isLocal = (url) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
if (!databaseUrl || !isLocal(databaseUrl)) throw new Error("Configurá E2E_DATABASE_URL con una base local de prueba.");
process.env.DATABASE_URL = databaseUrl;

const BASE_URL = process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
if (!isLocal(BASE_URL)) throw new Error("La API de la prueba de carga debe ser local.");
const ROW_COUNT = Number(process.argv.find((arg) => arg.startsWith("--rows="))?.split("=")[1] ?? 5000);
const TAG = `ZZPERF-${Date.now()}-`;
const SLOW_MS = 1500; // umbral generoso: lo que importa es que no crezca con la escala, no un número exacto.

const prisma = new PrismaClient();

function authCookie() {
  const statePath = path.join(__dirname, "..", "e2e", ".auth", "admin.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const token = state.cookies.find((cookie) => cookie.name === "sessionToken")?.value;
  if (!token) throw new Error("Sin sessionToken en e2e/.auth/admin.json: correr `npx playwright test` una vez para generarlo");
  return `sessionToken=${token}`;
}

async function timedFetch(cookie, query) {
  const start = performance.now();
  const response = await fetch(`${BASE_URL}/api/operations?${query}`, { headers: { cookie } });
  const ms = Math.round(performance.now() - start);
  if (!response.ok) throw new Error(`${query} → HTTP ${response.status}`);
  const body = await response.json();
  return { ms, total: body.total, rows: body.operations.length, limit: body.limit };
}

async function main() {
  const [currency] = await prisma.currency.findMany({ take: 1, where: { isActive: true } });
  if (!currency) throw new Error("Sin moneda activa para la prueba; correr el seed local primero");

  console.log(`Sembrando ${ROW_COUNT} operaciones de prueba (${TAG}...) en la base local...`);
  const now = new Date();
  const data = Array.from({ length: ROW_COUNT }, (_, i) => ({
    operationNumber: `${TAG}${String(i).padStart(7, "0")}`,
    originCurrencyId: currency.id,
    destCurrencyId: currency.id,
    originAmount: 100,
    destAmount: 100,
    exchangeRate: 1,
    operationDate: now,
  }));
  // createMany en tandas: una sola sentencia con miles de filas es más lenta de preparar que varias chicas.
  const BATCH = 1000;
  const results = {};
  try {
    for (let i = 0; i < data.length; i += BATCH) {
      await prisma.operation.createMany({ data: data.slice(i, i + BATCH) });
    }
    const cookie = authCookie();
    // Sin filtro: la primera pantalla de la lista, con miles de filas de por medio.
    results.sinFiltro = await timedFetch(cookie, "limit=80");
    // Una letra: lo primero que ve el buscador al tipear. Debe coincidir con las 5000 de prueba
    // y con cualquier operación real cuyo número empiece distinto, pero igual paginar a `limit`.
    results.unaLetra = await timedFetch(cookie, `q=${TAG.slice(0, 3)}&limit=80`);
    // Varios caracteres: acota el resultado a una porción de las de prueba (las que arrancan con "00").
    results.variosCaracteres = await timedFetch(cookie, `q=${TAG}00&limit=80`);

    for (const [label, result] of Object.entries(results)) {
      console.log(`${label}: ${result.ms}ms, total=${result.total}, filas devueltas=${result.rows} (límite ${result.limit})`);
      if (result.rows > result.limit) throw new Error(`${label}: devolvió más filas que el límite (${result.rows} > ${result.limit}) — no está paginando`);
      if (result.ms > SLOW_MS) throw new Error(`${label}: tardó ${result.ms}ms, por encima del umbral de ${SLOW_MS}ms`);
    }
    // Las 5000 de prueba deberían aparecer completas en el conteo de "una letra" (coincide con el prefijo).
    if (results.unaLetra.total < ROW_COUNT) throw new Error(`"una letra" esperaba total >= ${ROW_COUNT}, encontró ${results.unaLetra.total}`);

    console.log(`OK: con ${ROW_COUNT} operaciones de prueba, las listas siguen paginando por el servidor y respondiendo por debajo de ${SLOW_MS}ms.`);
  } finally {
    const deleted = await prisma.operation.deleteMany({ where: { operationNumber: { startsWith: TAG } } });
    console.log(`Limpieza: ${deleted.count} operaciones de prueba borradas.`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
