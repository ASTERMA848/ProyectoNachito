import type { APIRequestContext, Page } from "@playwright/test";
import { asRole, expect, expectAccessible, settle, test, unique } from "./fixtures";

// F01 crear una venta y completarla; F11 líneas de una venta distribuida.

const totalOperations = async (request: APIRequestContext) => (await (await request.get("/api/operations?limit=1")).json()).total as number;

// Selector de contactos: se escribe y Enter elige la primera coincidencia.
async function pick(page: Page, label: string | RegExp, text: string) {
  const field = page.getByRole("combobox", { name: label });
  await field.fill(text);
  await expect(page.getByRole("listbox")).toBeVisible();
  await field.press("Enter");
}

async function fillHeader(page: Page, { paid = true } = {}) {
  // Los campos obligatorios llevan un asterisco en la etiqueta.
  await pick(page, /^Proveedor/, "Casa Norte");
  await page.getByLabel(/^Moneda\s*\*?$/).selectOption({ label: "USD · Dólar Estadounidense" });
  await page.getByLabel(/^Cotización\s*\*?$/).fill("1200");
  await page.getByLabel(/^Estado del pago/).selectOption(paid ? "true" : "false");
}

async function fillLine(page: Page, index: number, client: string, amount: string, paid = true) {
  await pick(page, `Cliente de la línea ${index}`, client);
  await page.getByLabel(`Monto de la línea ${index}`).fill(amount);
  await page.getByLabel(`Cobrado, línea ${index}`).setChecked(paid);
}

test.describe("F01 ventas (administrador)", () => {
  test.use(asRole("admin"));

  test("F01-H1 registrar una venta cobrada y pagada la deja completada", async ({ page, request }) => {
    await page.goto("/operations/new?type=single");
    await settle(page);
    await expectAccessible(page, "S07 venta nueva");
    await fillHeader(page);
    await fillLine(page, 1, "Carlos Benítez", "100");
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Venta registrada" })).toBeVisible();
    await expect(page).toHaveURL(/\/operations\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    const detail = await (await request.get(`/api/operations/${id}`)).json();
    expect(detail.operation.state).toBe("COMPLETED");
    await expectAccessible(page, "S07 venta guardada");
  });

  test("F01-E5 el selector busca sin tildes y crea un contacto sin salir", async ({ page, request }) => {
    const name = unique("Proveedor rápido");
    await page.goto("/operations/new?type=single");
    await settle(page);
    const client = page.getByRole("combobox", { name: "Cliente de la línea 1" });
    await client.fill("benitez");
    await expect(page.getByRole("option", { name: /Carlos Benítez/ })).toBeVisible();
    await client.press("ArrowDown");
    await client.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    const provider = page.getByRole("combobox", { name: /^Proveedor/ });
    await provider.fill(name);
    await page.getByRole("option", { name: `Crear «${name}»` }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} creado como proveedor` })).toBeVisible();
    await expect(provider).toHaveValue(name);
    const found = await (await request.get(`/api/contacts?q=${encodeURIComponent(name)}&filter=role:provider`)).json();
    expect(found.total).toBe(1);
  });

  test("F01-E1 sin datos obligatorios no se guarda", async ({ page, request }) => {
    const before = await totalOperations(request);
    await page.goto("/operations/new?type=single");
    await settle(page);
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByText("Elegí el proveedor.")).toBeVisible();
    await expect(page.getByText("Elegí la moneda que se compra.")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "falta el cliente" })).toBeVisible();
    await expect(page).toHaveURL(/\/operations\/new/);
    expect(await totalOperations(request)).toBe(before);
  });

  test("F01-E2 y E4 doble clic crea una sola venta y las observaciones largas con emoji se guardan", async ({ page, request }) => {
    const before = await totalOperations(request);
    const note = `${"Observación con tildes áéíóú ñ y emoji 💱 ".repeat(40)}`.slice(0, 1990);
    await page.goto("/operations/new?type=single");
    await settle(page);
    await fillHeader(page, { paid: false });
    await fillLine(page, 1, "Laura Sosa", "50", false);
    await page.getByRole("tab", { name: "Observaciones" }).click();
    await page.getByLabel("Observaciones de la venta").fill(note);
    await page.getByRole("button", { name: "Registrar venta" }).dblclick();
    await expect(page).toHaveURL(/\/operations\/[0-9a-f-]{36}$/);
    await settle(page);
    expect(await totalOperations(request)).toBe(before + 1);
    const id = page.url().split("/").pop()!;
    const detail = await (await request.get(`/api/operations/${id}`)).json();
    expect(detail.operation.observations).toBe(note);
  });

  test("F01-E3 salir con cambios sin guardar pide confirmación", async ({ page, request }) => {
    const list = await (await request.get("/api/operations?filter=type:single&filter=state:pending&limit=1")).json();
    test.skip(!list.operations.length, "no hay una venta pendiente en los datos de prueba");
    await page.goto(`/operations/${list.operations[0].id}`);
    await settle(page);
    await page.getByRole("tab", { name: "Observaciones" }).click();
    await page.getByLabel("Observaciones de la venta").fill(unique("cambio sin guardar"));
    await page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Operaciones" }).click();
    const dialog = page.getByRole("dialog", { name: "Cambios sin guardar" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(page).toHaveURL(/\/operations\/[0-9a-f-]{36}$/);
  });
});

// El cierre contable se pone y se saca con una conexión propia: aunque la prueba se corte por tiempo,
// el afterAll lo restaura y no deja bloqueadas las demás pruebas.
test.describe("F01 cierre contable (administrador)", () => {
  test.use(asRole("admin"));
  let admin: APIRequestContext;
  let saved: { mainCurrencyId: string | null; accountingBlockDate: string | null };

  test.beforeAll(async ({ playwright, baseURL }) => {
    admin = await playwright.request.newContext({ baseURL, storageState: asRole("admin").storageState });
    saved = (await (await admin.get("/api/settings")).json()).settings;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect((await admin.put("/api/settings", { data: { mainCurrencyId: saved.mainCurrencyId, accountingBlockDate: tomorrow } })).ok()).toBe(true);
  });

  test.afterAll(async () => {
    await admin.put("/api/settings", { data: { mainCurrencyId: saved.mainCurrencyId, accountingBlockDate: saved.accountingBlockDate?.slice(0, 10) ?? "" } });
    await admin.dispose();
  });

  test("F01-N3 no se puede cargar una venta con fecha anterior al cierre contable", async ({ page, request }) => {
    const before = await totalOperations(request);
    await page.goto("/operations/new?type=single");
    await settle(page);
    await fillHeader(page);
    await fillLine(page, 1, "Mario Pérez", "10");
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "anterior al bloqueo contable" })).toBeVisible();
    expect(await totalOperations(request)).toBe(before);
  });
});

test.describe("F11 venta distribuida (administrador)", () => {
  test.use(asRole("admin"));

  test("F11-H1, E1 y E2 agregar, validar y quitar líneas", async ({ page, request }) => {
    await page.goto("/operations/new?type=distributed");
    await settle(page);
    await fillHeader(page, { paid: false });
    await fillLine(page, 1, "Julieta Ramos", "300", false);
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    await pick(page, "Cliente de la línea 2", "Distribuidora");
    await page.getByLabel("Cobrado, línea 2").setChecked(false);
    // E2: línea sin monto.
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "el monto tiene que ser mayor a cero" })).toBeVisible();
    await page.getByLabel("Monto de la línea 2").fill("200");
    await expect(page.getByRole("tab", { name: "Clientes (2)" })).toBeVisible();
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Venta registrada" })).toBeVisible();
    await expect(page).toHaveURL(/\/operations\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    let detail = await (await request.get(`/api/operations/${id}`)).json();
    expect(detail.operation.childOperations).toHaveLength(2);
    expect(detail.operation.originAmount).toBe(500);

    // E1: quitar una línea.
    await settle(page);
    await page.getByRole("button", { name: "Quitar la línea 2" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cambios guardados" })).toBeVisible();
    detail = await (await request.get(`/api/operations/${id}`)).json();
    expect(detail.operation.childOperations).toHaveLength(1);
    expect(detail.operation.originAmount).toBe(300);
  });
});

test.describe("F01 permisos del operador", () => {
  test.use(asRole("operador"));

  test("F01-N1 el operador no puede editar una venta completada", async ({ page }) => {
    const list = await (await page.request.get("/api/operations?filter=type:single&filter=state:completed&limit=1")).json();
    test.skip(!list.operations.length, "no hay una venta completada");
    await page.goto(`/operations/${list.operations[0].id}`);
    await settle(page);
    await expect(page.getByText("Esta venta está completada. Solo un administrador puede modificarla.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar" })).toHaveCount(0);
    const response = await page.request.put(`/api/operations/distributed-sale/${list.operations[0].id}`, { data: {} });
    expect([400, 403]).toContain(response.status());
  });
});

test.describe("F01 permisos de la auditora", () => {
  test.use(asRole("auditora"));

  test("F01-N2 la auditora solo consulta", async ({ page }) => {
    await page.goto("/operations");
    await settle(page);
    await expect(page.getByRole("button", { name: "Nuevo" })).toHaveCount(0);
    const list = await (await page.request.get("/api/operations?filter=type:single&limit=1")).json();
    await page.goto(`/operations/${list.operations[0].id}`);
    await settle(page);
    await expect(page.getByText("Tu rol puede consultar las operaciones pero no modificarlas.")).toBeVisible();
    const response = await page.request.post("/api/operations/distributed-sale", { data: {} });
    expect(response.status()).toBe(403);
  });
});
