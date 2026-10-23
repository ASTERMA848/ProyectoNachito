import type { APIRequestContext } from "@playwright/test";
import { asRole, expect, expectAccessible, settle, test } from "./fixtures";

// F05 registrar un movimiento desde el tablero de tesorería.

const boxBalance = async (request: APIRequestContext, name: string) => {
  const board = await (await request.get("/api/treasury?days=2")).json();
  return board.accounts.find((box: { name: string }) => box.name === name).balance as number;
};

test.describe("F05 administrador", () => {
  test.use(asRole("admin"));

  test("F05-H1 ingreso desde la tarjeta de una caja", async ({ page, request }) => {
    const before = await boxBalance(request, "Caja euros");
    await page.goto("/treasury");
    await settle(page);
    await expectAccessible(page, "S13 tablero de tesorería");
    await page.getByRole("article", { name: "Caja euros" }).getByRole("button", { name: "Movimiento", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /Movimiento en Caja euros/ });
    await dialog.getByLabel(/^Importe/).fill("12,5");
    await dialog.getByLabel(/^Motivo/).fill("Prueba de punta a punta");
    await expectAccessible(page, "diálogo de movimiento");
    await dialog.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ingreso registrado" })).toBeVisible();
    expect(await boxBalance(request, "Caja euros")).toBeCloseTo(before + 12.5, 6);
  });

  test("F05-E1 importe vacío, cero o texto no se registra", async ({ page }) => {
    await page.goto("/treasury");
    await settle(page);
    await page.getByRole("article", { name: "Caja euros" }).getByRole("button", { name: "Movimiento", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /Movimiento en Caja euros/ });
    await dialog.getByLabel(/^Motivo/).fill("Prueba");
    for (const value of ["", "0", "abc"]) {
      await dialog.getByLabel(/^Importe/).fill(value);
      await dialog.getByRole("button", { name: "Registrar" }).click();
      await expect(dialog.getByText("Escribí un importe mayor a cero")).toBeVisible();
    }
    // F05-E3 cancelar no cambia nada.
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });

  test("F05-E2 extraer más que el saldo no se permite ni por la API", async ({ request }) => {
    const board = await (await request.get("/api/treasury?days=2")).json();
    const box = board.accounts.find((item: { name: string }) => item.name === "Caja BRL");
    const response = await request.post("/api/treasury", { data: { accountId: box.id, type: "EXPENSE", amount: box.balance + 1, reason: "Prueba" } });
    expect(response.status()).toBe(409);
    expect(await boxBalance(request, "Caja BRL")).toBe(box.balance);
  });

  test("F05-E4 los dos traspasos simultáneos no dejan la caja en negativo", async ({ request }) => {
    const board = await (await request.get("/api/treasury?days=2")).json();
    const origin = board.accounts.find((item: { name: string }) => item.name === "Billetera USDT");
    const dest = board.accounts.find((item: { name: string }) => item.name === "Caja dólares");
    test.skip(origin.balance < 2, "la billetera no tiene saldo");
    const amount = Math.floor(origin.balance * 0.6);
    const send = () => request.post("/api/treasury/transfer", { data: { originAccountId: origin.id, destAccountId: dest.id, originAmount: amount, destAmount: amount, exchangeRate: 1, reason: "Prueba simultánea" } });
    const statuses = (await Promise.all([send(), send()])).map((response) => response.status()).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await boxBalance(request, "Billetera USDT")).toBeGreaterThanOrEqual(0);
    // Se devuelve lo traspasado para dejar los datos como estaban.
    await request.post("/api/treasury/transfer", { data: { originAccountId: dest.id, destAccountId: origin.id, originAmount: amount, destAmount: amount, exchangeRate: 1, reason: "Devolución de prueba" } });
  });
});

test.describe("F05 auditora", () => {
  test.use(asRole("auditora"));

  test("F05-N1 la auditora no carga movimientos", async ({ page, request }) => {
    await page.goto("/treasury");
    await settle(page);
    await expect(page.getByRole("button", { name: "Movimiento", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Traspaso" })).toHaveCount(0);
    const board = await (await request.get("/api/treasury?days=2")).json();
    const response = await request.post("/api/treasury", { data: { accountId: board.accounts[0].id, type: "INCOME", amount: 1, reason: "x" } });
    expect(response.status()).toBe(403);
  });
});
