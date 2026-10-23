// Datos de prueba inventados para la base de desarrollo local (no corre contra otra base).
// Requisitos: base local con `prisma db push` y `node prisma/seed.js`, y `npm run dev` levantado.
// Uso: npm run db:seed-demo
//
// Usuarios de prueba que crea (solo para la base local):
//   operador / operador1234 (OPERATOR)   auditora / auditora1234 (AUDITOR)   admin / admin (de prisma/seed.js)
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

// La base local manda sobre .env. Se lee antes de cargar Prisma, que si no toma la de .env.
const root = path.join(__dirname, "..");
const localEnv = path.join(root, ".env.development.local");
if (fs.existsSync(localEnv)) {
  const match = fs.readFileSync(localEnv, "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m);
  if (match) process.env.DATABASE_URL = match[1];
}
const { PrismaClient } = require("@prisma/client");
const API = process.env.SEED_API_URL || "http://localhost:3000";

function assertLocal() {
  const db = new URL(process.env.DATABASE_URL || "postgresql://none");
  const api = new URL(API);
  const local = (host) => ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!local(db.hostname) || !local(api.hostname)) {
    console.error(`Corte: la base (${db.hostname}) o la API (${api.hostname}) no son locales. Estos datos son solo para desarrollo.`);
    process.exit(1);
  }
}

const prisma = new PrismaClient();
let cookie = "";

async function api(method, url, body) {
  const response = await fetch(`${API}${url}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${data.error || ""}`);
  return { response, data };
}

async function login() {
  const { response } = await api("POST", "/api/auth/login", { username: "admin", password: "admin" });
  cookie = (response.headers.get("set-cookie") || "").split(";")[0];
}

const day = (offset) => {
  const date = new Date("2026-10-22T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

async function main() {
  assertLocal();
  if (await prisma.operation.count()) {
    console.log("La base ya tiene operaciones: no se cargan datos de prueba otra vez.");
    return;
  }

  const hash = (password) => bcrypt.hash(password, 12);
  await prisma.user.createMany({
    data: [
      { username: "operador", passwordHash: await hash("operador1234"), role: "OPERATOR" },
      { username: "auditora", passwordHash: await hash("auditora1234"), role: "AUDITOR" },
    ],
    skipDuplicates: true,
  });

  const [mayorista, frecuente] = await Promise.all([
    prisma.tag.upsert({ where: { name: "Mayorista" }, update: {}, create: { name: "Mayorista", color: "#2563eb" } }),
    prisma.tag.upsert({ where: { name: "Frecuente" }, update: {}, create: { name: "Frecuente", color: "#16a34a" } }),
  ]);

  const contact = (data, tags = []) => prisma.contact.create({ data: { ...data, tags: { create: tags.map((tag) => ({ tagId: tag.id })) } } });
  const mario = await contact({ name: "Mario", lastname: "Pérez", document: "27123456", phone: "11 5555-0101", email: "mario.perez@example.test", isClient: true }, [frecuente]);
  const laura = await contact({ name: "Laura", lastname: "Sosa", document: "30987654", phone: "11 5555-0102", email: "laura.sosa@example.test", isClient: true });
  const rio = await contact({ name: "Distribuidora Río SRL", cuitCuil: "30-71234567-8", phone: "11 5555-0103", isClient: true }, [mayorista]);
  const julieta = await contact({ name: "Julieta", lastname: "Ramos", document: "33222111", isClient: true });
  const carlos = await contact({ name: "Carlos", lastname: "Benítez", document: "25444333", isClient: true, observations: "Prefiere retirar por la tarde." });
  const andino = await contact({ name: "Grupo Andino SA", cuitCuil: "30-70999888-1", isClient: true, isProvider: true }, [mayorista]);
  const norte = await contact({ name: "Casa Norte Cambios", cuitCuil: "30-71111222-3", isProvider: true });
  const sur = await contact({ name: "Cambios Sur SA", cuitCuil: "30-72222333-4", isProvider: true });

  const currencies = Object.fromEntries((await prisma.currency.findMany()).map((currency) => [currency.code, currency]));
  await prisma.treasuryAccount.createMany({
    data: [
      { name: "Caja pesos", type: "CASH", currencyId: currencies.ARS.id, balance: 25000000 },
      { name: "Caja dólares", type: "CASH", currencyId: currencies.USD.id, balance: 40000 },
      { name: "Caja euros", type: "CASH", currencyId: currencies.EUR.id, balance: 6000 },
      { name: "Cuenta bancaria", type: "BANK", currencyId: currencies.ARS.id, balance: 12000000 },
      { name: "Billetera USDT", type: "WALLET", currencyId: currencies.USDT.id, balance: 3500 },
    ],
  });

  await login();

  // Ventas por la misma ruta que usa la interfaz: así quedan cuentas, cajas y auditoría coherentes.
  const sale = (body) => api("POST", "/api/operations/distributed-sale", { providerPaymentCurrencyId: "", providerPaymentRate: "", observations: "", ...body });
  const line = (client, amount, isPaid, extra = {}) => ({ clientId: client.id, amount, exchangeRate: "", isPaid, observations: "", ...extra });
  const usd = currencies.USD.id;
  const eur = currencies.EUR.id;

  await sale({ operationType: "SINGLE_SALE", providerId: norte.id, currencyId: usd, exchangeRate: 1185, operationDate: day(-35), providerIsPaid: true, items: [line(mario, 1500, true)] });
  await sale({ operationType: "SINGLE_SALE", providerId: sur.id, currencyId: eur, exchangeRate: 1290, operationDate: day(-30), providerIsPaid: true, items: [line(laura, 800, true)] });
  await sale({
    operationType: "DISTRIBUTED_SALE",
    providerId: norte.id,
    currencyId: usd,
    exchangeRate: 1188,
    operationDate: day(-21),
    providerIsPaid: true,
    observations: "Lote semanal para clientes frecuentes.",
    items: [line(mario, 2000, true), line(laura, 1200, true), line(julieta, 500, false, { exchangeRate: 1195 })],
  });
  await sale({ operationType: "SINGLE_SALE", providerId: andino.id, currencyId: usd, exchangeRate: 1190, operationDate: day(-14), providerIsPaid: false, items: [line(rio, 12000, true)] });
  await sale({ operationType: "SINGLE_SALE", providerId: norte.id, currencyId: usd, exchangeRate: 1192, operationDate: day(-9), providerIsPaid: false, items: [line(carlos, 650, false)] });
  await sale({
    operationType: "DISTRIBUTED_SALE",
    providerId: sur.id,
    currencyId: eur,
    exchangeRate: 1295,
    operationDate: day(-7),
    providerIsPaid: false,
    items: [line(laura, 300, false), line(carlos, 450, true)],
  });
  await sale({ operationType: "SINGLE_SALE", providerId: norte.id, currencyId: usd, exchangeRate: 1194, operationDate: day(-3), providerIsPaid: true, items: [line(julieta, 900, false)] });
  await sale({ operationType: "SINGLE_SALE", providerId: andino.id, currencyId: usd, exchangeRate: 1196, operationDate: day(-1), providerIsPaid: true, items: [line(mario, 3000, true)] });
  await sale({
    operationType: "DISTRIBUTED_SALE",
    providerId: norte.id,
    currencyId: usd,
    exchangeRate: 1198,
    operationDate: day(0),
    providerIsPaid: false,
    items: [line(rio, 5000, false), line(mario, 700, false), line(julieta, 350, false), line(carlos, 1000, false)],
  });
  await sale({ operationType: "SINGLE_SALE", providerId: sur.id, currencyId: usd, exchangeRate: 1199, operationDate: day(0), providerIsPaid: false, items: [line(laura, 250, false)] });

  // Operaciones estándar como las anteriores a las ventas: una se completa y otra se cancela.
  const standard = (body) => api("POST", "/api/operations", { observations: "", ...body });
  const ars = currencies.ARS.id;
  const first = await standard({ clientId: carlos.id, providerId: norte.id, originCurrencyId: usd, destCurrencyId: ars, originAmount: 400, destAmount: 472000, exchangeRate: 1180, operationDate: day(-40) });
  await api("PATCH", `/api/operations/${first.data.id}`, { state: "COMPLETED" });
  const second = await standard({ clientId: julieta.id, providerId: sur.id, originCurrencyId: eur, destCurrencyId: ars, originAmount: 200, destAmount: 256000, exchangeRate: 1280, operationDate: day(-38) });
  await api("PATCH", `/api/operations/${second.data.id}`, { state: "CANCELED" });
  await standard({ clientId: andino.id, providerId: norte.id, originCurrencyId: usd, destCurrencyId: ars, originAmount: 1000, destAmount: 1183000, exchangeRate: 1183, operationDate: day(-2) });

  const summary = await prisma.operation.groupBy({ by: ["state"], where: { parentOperationId: null, deletedAt: null }, _count: { _all: true } });
  console.log("Datos de prueba cargados:", summary.map((row) => `${row.state} ${row._count._all}`).join(", "));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
