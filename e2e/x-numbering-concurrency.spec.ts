import { asRole, expect, test } from "./fixtures";

// Imprescindible #2 de replica-entrepreneur (replica/fixes.md): usuarios de Odoo reportan saltos
// en la numeración de documentos cuando dos se generan casi al mismo tiempo. nextOperationNumber
// (src/lib/distributed-sale.ts) ya serializa la numeración con pg_advisory_xact_lock; esta prueba
// demuestra que, bajo carga concurrente real, no quedan ni números repetidos ni huecos.
test.use(asRole("admin"));

const CONCURRENT_SALES = 12;

test("X-7 crear muchas ventas al mismo tiempo no repite ni salta números de operación", async ({ request }) => {
  const [contacts, currencies] = await Promise.all([
    request.get("/api/contacts?options=1").then((response) => response.json()),
    request.get("/api/currencies").then((response) => response.json()),
  ]);
  const provider = contacts.contacts.find((contact: { isProvider: boolean; isActive: boolean }) => contact.isProvider && contact.isActive);
  const client = contacts.contacts.find((contact: { isClient: boolean; isActive: boolean }) => contact.isClient && contact.isActive);
  const currency = currencies.currencies.find((item: { code: string; isActive: boolean }) => item.code !== "ARS" && item.isActive);

  const body = {
    operationType: "SINGLE_SALE",
    providerId: provider.id,
    currencyId: currency.id,
    exchangeRate: 1,
    operationDate: new Date().toISOString().slice(0, 10),
    providerIsPaid: false,
    items: [{ clientId: client.id, amount: 1, isPaid: false }],
  };

  // Todas a la vez, no una tras otra: es la carrera que puede dejar huecos o números repetidos.
  const responses = await Promise.all(Array.from({ length: CONCURRENT_SALES }, () => request.post("/api/operations/distributed-sale", { data: body })));
  const okResponses = responses.filter((response) => response.ok());
  expect(okResponses.length, "todas las ventas tenían datos válidos: todas deberían guardarse").toBe(CONCURRENT_SALES);

  const results = await Promise.all(okResponses.map((response) => response.json()));
  const numbers = results.map((result) => result.parentOp.operationNumber as string);

  // Sin dos operaciones con el mismo número.
  expect(new Set(numbers).size).toBe(numbers.length);

  // Y sin huecos entre el número más chico y el más grande de esta tanda: nadie más estaba
  // creando operaciones al mismo tiempo (la base de prueba corre en un solo worker de Playwright).
  const values = numbers.map((number) => Number(number.replace(/^OP-/, ""))).sort((a, b) => a - b);
  expect(values[values.length - 1] - values[0] + 1).toBe(values.length);

  await Promise.all(results.map((result) => request.delete(`/api/operations/${result.parentOp.id}`)));
});
