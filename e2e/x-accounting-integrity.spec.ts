import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { asRole } from "./fixtures";

test.use(asRole("admin"));

async function createStandard(request: APIRequestContext) {
  const currencies = (await (await request.get("/api/currencies")).json()).currencies;
  const usd = currencies.find(({ code }) => code === "USD");
  const ars = currencies.find(({ code }) => code === "ARS");
  const suffix = crypto.randomUUID();
  const addContact = async (name: string, role: "isClient" | "isProvider") => {
    const response = await request.post("/api/contacts", { data: { name: `${name} ${suffix}`, [role]: true } });
    expect(response.status()).toBe(201);
    return (await response.json()).id as string;
  };
  const input = {
    clientId: await addContact("Cliente conciliación", "isClient"),
    providerId: await addContact("Proveedor conciliación", "isProvider"),
    originCurrencyId: usd.id,
    destCurrencyId: ars.id,
    originAmount: "0.1",
    destAmount: "100",
    exchangeRate: "1000",
    operationDate: "2026-01-05",
  };
  const response = await request.post("/api/operations", { data: input });
  expect(response.status()).toBe(201);
  return { input, id: (await response.json()).id as string };
}

test("conciliación al editar y borrar simultáneamente una operación completada", async ({ request }) => {
  const { input, id } = await createStandard(request);
  const path = `/api/operations/${id}`;
  expect((await request.patch(path, { data: { state: "COMPLETED" } })).ok()).toBe(true);
  const getBalance = async () => {
    const result = await (await request.get(`/api/accounts?filter=contact:${input.clientId}`)).json();
    return result.accounts.find(({ currency }) => currency.id === input.originCurrencyId)?.balance;
  };
  expect(await getBalance()).toBe(0.1);
  const edited = await request.put(path, { data: { ...input, originAmount: "0.3", destAmount: "300" } });
  expect(edited.status()).toBe(200);
  expect(await getBalance()).toBe(0.3);
  const results = await Promise.all([request.delete(path), request.delete(path)]);
  expect(results.map((response) => response.status()).sort()).toEqual([200, 404]);
  expect(await getBalance()).toBe(0);
});

test("el cierre contable bloquea edición, pago y borrado de una operación anterior", async ({ request }) => {
  const { input, id } = await createStandard(request);
  const path = `/api/operations/${id}`;
  const { settings } = await (await request.get("/api/settings")).json();
  expect((await request.put("/api/settings", { data: { accountingBlockDate: "2026-02-01" } })).ok()).toBe(true);
  try {
    for (const response of [
      await request.put(path, { data: { ...input, operationDate: "2026-02-03" } }),
      await request.patch(path, { data: { state: "COMPLETED", isPaid: true } }),
      await request.delete(path),
    ]) {
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toMatch(/cierre contable/i);
    }
    const { operation, counts } = await (await request.get(path)).json();
    expect(operation.state).toBe("PENDING");
    expect(counts.transactions).toBe(0);
  } finally {
    expect((await request.put("/api/settings", { data: { accountingBlockDate: settings.accountingBlockDate?.slice(0, 10) ?? "" } })).ok()).toBe(true);
    expect((await request.delete(path)).ok()).toBe(true);
  }
});

test("conciliación de cajas en un traspaso de la misma moneda", async ({ request }) => {
  const db = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });
  try {
    const currency = await db.currency.findUniqueOrThrow({ where: { code: "USD" } });
    const origin = await db.treasuryAccount.create({ data: { name: "Origen conciliación", currencyId: currency.id, type: "BANK", balance: 100 } });
    const dest = await db.treasuryAccount.create({ data: { name: "Destino conciliación", currencyId: currency.id, type: "BANK" } });
    const input = { originAccountId: origin.id, destAccountId: dest.id, originAmount: 10 };
    try {
      const invalid = await request.post("/api/treasury/transfer", { data: { ...input, destAmount: 50 } });
      expect(invalid.status()).toBe(400);
      expect(Number((await db.treasuryAccount.findUniqueOrThrow({ where: { id: origin.id } })).balance)).toBe(100);
      expect(Number((await db.treasuryAccount.findUniqueOrThrow({ where: { id: dest.id } })).balance)).toBe(0);
      const valid = await request.post("/api/treasury/transfer", { data: { ...input, destAmount: 10 } });
      expect(valid.status()).toBe(201);
      const result = await valid.json();
      expect(result.originAccount.balance).toBe(90);
      expect(result.destAccount.balance).toBe(10);
      expect((await request.delete(`/api/operations/${result.originMovement.operationId}`)).ok()).toBe(true);
    } finally {
      await db.treasuryAccount.deleteMany({ where: { id: { in: [origin.id, dest.id] } } });
    }
  } finally {
    await db.$disconnect();
  }
});
