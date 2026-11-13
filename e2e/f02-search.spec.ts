import type { Page } from "@playwright/test";
import { asRole, expect, expectAccessible, settle, test } from "./fixtures";

// F02 buscar, filtrar y agrupar en Operaciones.
test.use(asRole("admin"));

test("F02-H1 buscar y filtrar", async ({ page, request }) => {
  await page.goto("/operations");
  await settle(page);
  await expectAccessible(page, "S03 lista de operaciones");
  const search = page.getByRole("combobox", { name: "Buscar operaciones" });
  await search.fill("Casa Norte");
  await search.press("Enter");
  await expect(page.getByRole("list", { name: "Filtros aplicados" })).toContainText("Casa Norte");
  await expect(page).toHaveURL(/q=Casa/);
  await page.getByRole("button", { name: "Opciones de búsqueda" }).click();
  await page.getByRole("button", { name: "Pendientes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pendientes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/filter=state%3Apending|filter=state:pending/);
  const api = await (await request.get("/api/operations?q=Casa+Norte&filter=state:pending&limit=1")).json();
  await expect(page.getByRole("list", { name: "Filtros aplicados" })).toContainText("Pendientes");
  if (api.total > 0) await expect(page.getByText(new RegExp(`/ ${api.total}$`)).first()).toBeVisible();
  await expectAccessible(page, "S09 panel de búsqueda");
});

test("F02-E1 sin resultados muestra el estado vacío y se puede limpiar", async ({ page }) => {
  await page.goto("/operations?q=zzz-no-existe-zzz");
  await settle(page);
  await expect(page.getByText("Ninguna operación coincide", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page).not.toHaveURL(/q=/);
});

test("F02-E2 filtros del mismo grupo con O y de grupos distintos con Y", async ({ request }) => {
  const total = async (query: string) => (await (await request.get(`/api/operations?${query}&limit=1`)).json()).total as number;
  const pending = await total("filter=state:pending");
  const completed = await total("filter=state:completed");
  expect(await total("filter=state:pending&filter=state:completed")).toBe(pending + completed);
  const pendingToday = await total("filter=state:pending&filter=date:today");
  expect(pendingToday).toBeLessThanOrEqual(pending);
});

test("F02-E3 la búsqueda sobrevive a recargar y a volver atrás", async ({ page }) => {
  await page.goto("/operations?filter=state:pending&groupBy=state");
  await settle(page);
  await page.reload();
  await settle(page);
  await expect(page.getByRole("list", { name: "Filtros aplicados" })).toContainText("Pendiente");
  await page.goto("/contacts");
  await settle(page);
  await page.goBack();
  await settle(page);
  await expect(page).toHaveURL(/groupBy=state/);
});

test("F02-E4 un filtro inválido en la URL no rompe la pantalla", async ({ page, request }) => {
  const response = await request.get("/api/operations?filter=state:xx");
  expect(response.status()).toBe(400);
  await page.goto("/operations?filter=state:xx");
  await expect(page.getByRole("alert").filter({ hasText: "Filtro inválido" })).toBeVisible();
});

test("F02-E5 se encuentra un cliente por su apellido", async ({ request }) => {
  // Carlos Benítez está cargado con nombre "Carlos" y apellido "Benítez".
  const byName = await (await request.get("/api/operations?q=Carlos&limit=1")).json();
  test.skip(byName.total === 0, "no hay operaciones de Carlos Benítez en los datos de prueba");
  const byLastname = await (await request.get("/api/operations?q=Ben%C3%ADtez&limit=1")).json();
  expect(byLastname.total).toBe(byName.total);
  const byFullName = await (await request.get("/api/operations?q=Carlos+Ben%C3%ADtez&limit=1")).json();
  expect(byFullName.total).toBe(byName.total);
  const contacts = await (await request.get("/api/contacts?q=Carlos+Ben%C3%ADtez")).json();
  expect(contacts.total).toBe(1);
});

test("F02-E6 buscar en un campo desde las sugerencias, con el teclado", async ({ page, request }) => {
  await page.goto("/operations");
  await settle(page);
  const search = page.getByRole("combobox", { name: "Buscar operaciones" });
  await search.fill("benitez");
  const options = page.getByRole("listbox", { name: "Buscar en" }).getByRole("option");
  await expect(options).toHaveText(["Buscar «benitez» en todo", "Buscar Número: benitez", "Buscar Cliente: benitez", "Buscar Proveedor: benitez"]);
  await search.press("ArrowDown");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/qf=client(%3A|:)benitez/);
  await expect(page.getByRole("list", { name: "Filtros aplicados" })).toContainText("Cliente: benitez");
  const api = await (await request.get("/api/operations?qf=client:benitez&limit=1")).json();
  expect(api.total).toBeGreaterThan(0);
  await expect(page.getByText(new RegExp(`/ ${api.total}$`)).first()).toBeVisible();
  // Quitar la faceta vuelve a la lista completa.
  await page.getByRole("button", { name: /Quitar búsqueda Cliente: benitez/ }).click();
  await expect(page).not.toHaveURL(/qf=/);
});

test("F02-E7 la búsqueda ignora tildes y mayúsculas en operaciones, contactos y cuentas (BUG-004)", async ({ request }) => {
  const total = async (url: string) => (await (await request.get(url)).json()).total as number;
  expect(await total("/api/contacts?q=benitez")).toBe(await total("/api/contacts?q=Ben%C3%ADtez"));
  expect(await total("/api/contacts?q=benitez")).toBeGreaterThan(0);
  expect(await total("/api/operations?q=BENITEZ")).toBe(await total("/api/operations?q=Ben%C3%ADtez"));
  expect(await total("/api/accounts?q=perez")).toBe(await total("/api/accounts?q=P%C3%A9rez"));
  // Los comodines de SQL se buscan como texto.
  expect(await total("/api/contacts?q=%25")).toBe(0);
  expect((await request.get("/api/operations?qf=clave:x")).status()).toBe(400);
});

// Botón de un grupo de la tabla: "Pendiente (17)".
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const groupButton = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${escapeRegex(label)}\\s*\\(\\d+\\)$`) });

test("F02-E8 agrupar por dos campos: estado y después cliente", async ({ page, request }) => {
  await page.goto("/operations?groupBy=state,client");
  await settle(page);
  await expect(page.getByRole("list", { name: "Filtros aplicados" })).toContainText("Estado > Cliente");
  const top = await (await request.get("/api/operations?groupBy=state")).json();
  const pending = top.groups.find((group: { key: string }) => group.key === "PENDING");
  await groupButton(page, pending.label).click();
  // Los subgrupos de clientes suman lo mismo que el grupo de arriba.
  const sub = await (await request.get(`/api/operations?filter=${pending.filter}&groupBy=client&limit=1`)).json();
  expect(sub.groups.reduce((total: number, group: { count: number }) => total + group.count, 0)).toBe(pending.count);
  const first = sub.groups[0];
  await groupButton(page, first.label).click();
  await expect(page.getByRole("checkbox", { name: /^Seleccionar OP-/ })).toHaveCount(Math.min(first.count, 80));
  await expectAccessible(page, "S04 lista agrupada en dos niveles");
});

test("F02-E9 un grupo abre solo sus filas aunque el filtro tenga varios valores del mismo campo (BUG-007)", async ({ page, request }) => {
  const base = "filter=state:pending&filter=state:completed";
  const grouped = await (await request.get(`/api/operations?${base}&groupBy=state`)).json();
  const completed = grouped.groups.find((group: { key: string }) => group.key === "COMPLETED");
  test.skip(!completed, "no hay operaciones completadas");
  await page.goto(`/operations?${base}&groupBy=state`);
  await settle(page);
  await groupButton(page, completed.label).click();
  await expect(page.getByRole("checkbox", { name: /^Seleccionar OP-/ })).toHaveCount(Math.min(completed.count, 80));
});
