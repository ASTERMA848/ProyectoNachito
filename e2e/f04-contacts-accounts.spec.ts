import { asRole, expect, expectAccessible, settle, test, unique } from "./fixtures";

// F04 revisar un contacto y su cuenta.

test.describe("F04 administrador", () => {
  test.use(asRole("admin"));

  test("F04-H1 del contacto a sus operaciones y a su estado de cuenta", async ({ page, request }) => {
    await page.goto("/contacts");
    await settle(page);
    await expectAccessible(page, "S06 tarjetas de contactos");
    await page.getByRole("article").filter({ hasText: "Carlos Benítez" }).or(page.getByText("Carlos Benítez")).first().click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
    await settle(page);
    await expectAccessible(page, "S08 ficha de contacto");
    const id = page.url().split("/").pop()!;
    await page.getByRole("link", { name: /Operaciones/ }).click();
    await expect(page).toHaveURL(new RegExp(`filter=contact(%3A|:)${id}`));
    await settle(page);

    // Estado de cuenta: el saldo de la primera fila es el saldo de la cuenta y cada fila cierra con la siguiente.
    const accounts = await (await request.get(`/api/accounts?filter=contact:${id}`)).json();
    test.skip(!accounts.accounts.length, "el contacto no tiene cuenta corriente");
    const account = accounts.accounts[0];
    const movements = await (await request.get(`/api/accounts/${account.id}/transactions?limit=100`)).json();
    expect(movements.transactions[0].balance).toBeCloseTo(account.balance, 6);
    for (let index = 0; index < movements.transactions.length - 1; index += 1) {
      const row = movements.transactions[index];
      expect(movements.transactions[index + 1].balance).toBeCloseTo(row.balance - (row.credit - row.debit), 6);
    }
    await page.goto(`/accounts/${account.id}`);
    await settle(page);
    await expectAccessible(page, "estado de cuenta");
    await page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Cuentas corrientes" }).click();
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test("F04-E1 y E2 contacto nuevo sin movimientos, archivado y desarchivado", async ({ page, request }) => {
    const name = unique("Prueba Contacto");
    await page.goto("/contacts/new");
    await settle(page);
    await page.getByLabel(/^Nombre/).fill(name);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Contacto creado" })).toBeVisible();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
    await settle(page);
    await page.getByRole("tab", { name: "Saldos" }).click();
    await expect(page.getByText("Sin cuenta corriente")).toBeVisible();

    await page.getByRole("button", { name: "Archivar" }).first().click();
    await page.getByRole("dialog", { name: "Archivar contacto" }).getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByText("Este contacto está archivado")).toBeVisible();
    const active = await (await request.get(`/api/contacts?q=${encodeURIComponent(name)}`)).json();
    expect(active.total).toBe(0);
    const archived = await (await request.get(`/api/contacts?q=${encodeURIComponent(name)}&filter=status:archived`)).json();
    expect(archived.total).toBe(1);
    await page.getByRole("button", { name: "Desarchivar" }).first().click();
    await expect(page.getByText("Este contacto está archivado")).toHaveCount(0);
  });

  test("F04-E3 nombre de 200 caracteres no rompe la tarjeta ni la lista", async ({ page }) => {
    const name = `${"Nombre muy largo de contacto con tildes áéí ".repeat(5)}`.slice(0, 190) + Date.now().toString(36);
    await page.goto("/contacts/new");
    await settle(page);
    await page.getByLabel(/^Nombre/).fill(name);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
    await page.goto(`/contacts?q=${encodeURIComponent(name.slice(0, 60))}`);
    await settle(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("F04 API de contactos", () => {
  test.use(asRole("admin"));

  test("F04-E4 editar un contacto sin mandar etiquetas no se las borra", async ({ request }) => {
    const tags = (await (await request.get("/api/tags")).json()).tags;
    test.skip(!tags.length, "no hay etiquetas");
    const created = await (await request.post("/api/contacts", { data: { name: unique("Con etiqueta"), isClient: true, tagIds: [tags[0].id] } })).json();
    const response = await request.put(`/api/contacts/${created.id}`, { data: { name: `${created.name} editado`, isClient: true } });
    expect(response.ok()).toBe(true);
    const detail = await (await request.get(`/api/contacts/${created.id}`)).json();
    expect(detail.contact.tags.map((row: { tag: { id: string } }) => row.tag.id)).toEqual([tags[0].id]);
  });
});

test.describe("F04 auditora", () => {
  test.use(asRole("auditora"));

  test("F04-N1 la auditora ve el contacto pero no lo edita", async ({ page, request }) => {
    const list = await (await request.get("/api/contacts?limit=1")).json();
    await page.goto(`/contacts/${list.contacts[0].id}`);
    await settle(page);
    await expect(page.getByText("Tu rol puede consultar los contactos pero no modificarlos.")).toBeVisible();
    await expect(page.getByLabel(/^Nombre/)).toBeDisabled();
    const response = await request.put(`/api/contacts/${list.contacts[0].id}`, { data: { name: "x" } });
    expect(response.status()).toBe(403);
  });
});
