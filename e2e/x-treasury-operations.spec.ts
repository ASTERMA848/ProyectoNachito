import type { APIRequestContext } from "@playwright/test";
import { asRole, expect, settle, test } from "./fixtures";

// Operaciones que genera tesorería (ingresos, extracciones y traspasos): no se reabren ni se editan
// como una operación estándar, porque eso deshace sus movimientos de caja sin volver a aplicarlos.
test.use(asRole("admin"));

const balances = async (request: APIRequestContext) => {
  const board = await (await request.get("/api/treasury?days=2")).json();
  return Object.fromEntries(board.accounts.map((box: { name: string; balance: number }) => [box.name, box.balance])) as Record<string, number>;
};

async function newTransfer(request: APIRequestContext) {
  const board = await (await request.get("/api/treasury?days=2")).json();
  const origin = board.accounts.find((box: { name: string }) => box.name === "Caja dólares");
  const dest = board.accounts.find((box: { name: string }) => box.name === "Billetera USDT");
  const response = await request.post("/api/treasury/transfer", {
    data: { originAccountId: origin.id, destAccountId: dest.id, originAmount: 1, destAmount: 1, exchangeRate: 1, reason: "Prueba de reapertura" },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).originMovement.operationId as string;
}

test("X-4 reabrir y volver a completar un traspaso no puede hacer desaparecer el dinero", async ({ request }) => {
  const operationId = await newTransfer(request);
  const before = await balances(request);
  const reopen = await request.patch(`/api/operations/${operationId}`, { data: { state: "PENDING" } });
  const complete = await request.patch(`/api/operations/${operationId}`, { data: { state: "COMPLETED" } });
  const after = await balances(request);
  // O se rechaza el cambio de estado, o los saldos quedan como estaban: nunca un traspaso "completado" sin sus movimientos.
  expect(after).toEqual(before);
  expect([reopen.status(), complete.status()]).toEqual([400, 400]);
  const movements = await (await request.get(`/api/operations/${operationId}`)).json();
  expect(movements.counts.treasuryMovements).toBe(2);
  // Se elimina para devolver los saldos de la prueba.
  expect((await request.delete(`/api/operations/${operationId}`)).ok()).toBe(true);
});

test("X-5 la ficha de un traspaso no ofrece reabrirlo y lo nombra como tesorería", async ({ page, request }) => {
  const operationId = await newTransfer(request);
  await page.goto(`/operations/${operationId}`);
  await settle(page);
  await expect(page.getByRole("button", { name: "Reabrir" })).toHaveCount(0);
  await expect(page.getByText("Traspaso entre cajas").first()).toBeVisible();
  expect((await request.delete(`/api/operations/${operationId}`)).ok()).toBe(true);
});

test("X-6 agrupar por tipo nombra los tipos de tesorería y cada grupo abre sus propias filas", async ({ request }) => {
  const result = await (await request.get("/api/operations?groupBy=type")).json();
  for (const group of result.groups) {
    expect(group.label, group.filter).not.toMatch(/^[A-Z_]+$/);
    const rows = await (await request.get(`/api/operations?filter=${group.filter}&limit=1`)).json();
    expect(rows.total, `${group.label} (${group.filter})`).toBe(group.count);
  }
});
