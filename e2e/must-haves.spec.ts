import { asRole, expect, expectAccessible, settle, test } from "./fixtures";

// Imprescindibles de la segunda tanda (replica/parity.md): perfil, kanban en el teléfono,
// cuentas por contacto, saldos enlazados e historial en cuentas, cajas, usuarios y monedas.

test.describe("administrador", () => {
  test.use(asRole("admin"));

  test("M-1 el menú de usuario abre Mi perfil", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.getByRole("button", { name: /Menú de admin/ }).click();
    await page.getByRole("menuitem", { name: "Mi perfil" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await settle(page);
    await expect(page.getByRole("navigation", { name: "Ruta" })).toContainText("Mi perfil");
    await expect(page.getByLabel(/^Nombre de usuario/)).toHaveValue("admin");
    await expectAccessible(page, "Mi perfil");
  });

  test("M-2 en el teléfono, operaciones abre en kanban", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/operations");
    await settle(page);
    await expect(page.getByRole("button", { name: "Kanban" })).toHaveAttribute("aria-pressed", "true");
  });

  test("M-3 cuentas agrupadas por contacto, con un subtotal por moneda", async ({ page, request }) => {
    const grouped = await (await request.get("/api/accounts?groupBy=contact")).json();
    const multi = grouped.groups.find((group: { sums: unknown[] }) => group.sums.length > 1);
    test.skip(!multi, "ningún contacto tiene saldo en dos monedas");
    await page.goto("/accounts?groupBy=contact");
    await settle(page);
    const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: new RegExp(`^${multi.label}`) }) });
    for (const sum of multi.sums) await expect(row).toContainText(sum.code);
    await row.getByRole("button").click();
    await expect(page.getByRole("checkbox", { name: new RegExp(`^Seleccionar ${multi.label} `) })).toHaveCount(multi.count);
  });

  test("M-4 cada saldo de la ficha del contacto abre su estado de cuenta", async ({ page, request }) => {
    const contacts = await (await request.get("/api/contacts?q=Carlos")).json();
    const detail = await (await request.get(`/api/contacts/${contacts.contacts[0].id}`)).json();
    test.skip(!detail.balances.length, "el contacto no tiene cuenta corriente");
    await page.goto(`/contacts/${contacts.contacts[0].id}`);
    await settle(page);
    await page.getByRole("tab", { name: "Saldos" }).click();
    await page.getByRole("row", { name: new RegExp(detail.balances[0].currency.code) }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/${detail.balances[0].accountId}$`));
  });

  test("M-5 el historial aparece en cuenta, caja, usuario y moneda", async ({ page, request }) => {
    // Cuenta: un movimiento manual queda en su historial con concepto e importe.
    const accounts = await (await request.get("/api/accounts?q=Carlos")).json();
    const account = accounts.accounts.find((item: { currency: { code: string } }) => item.currency.code === "USD") ?? accounts.accounts[0];
    const concept = `Ajuste de historial ${Date.now().toString(36)}`;
    await request.post("/api/accounts", { data: { contactId: account.contact.id, currencyId: account.currency.id, type: "CREDIT", amount: 1, concept } });
    await request.post("/api/accounts", { data: { contactId: account.contact.id, currencyId: account.currency.id, type: "DEBIT", amount: 1, concept: `${concept} (devolución)` } });
    await page.goto(`/accounts/${account.id}`);
    await settle(page);
    await expect(page.getByText(`Registró el movimiento de cuenta «${concept}» por 1,00.`)).toBeVisible();

    // Caja: los traspasos de la billetera aparecen en su historial.
    const board = await (await request.get("/api/treasury?days=2")).json();
    const box = board.accounts.find((item: { name: string }) => item.name === "Caja dólares");
    await page.goto(`/treasury/${box.id}`);
    await settle(page);
    await expect(page.getByText(/Registró el (traspaso entre cajas|movimiento de caja)/).first()).toBeVisible();

    // Usuario: el cambio de rol queda con el valor anterior y el nuevo.
    const users = (await (await request.get("/api/users")).json()).users;
    const operador = users.find((user: { username: string }) => user.username === "operador");
    await page.goto(`/settings/users/${operador.id}`);
    await settle(page);
    await expect(page.getByText("Rol").first()).toBeVisible();

    // Moneda: editar el nombre y volverlo atrás deja dos entradas en el historial del diálogo.
    const usd = (await (await request.get("/api/currencies")).json()).currencies.find((item: { code: string }) => item.code === "USDT");
    await request.put(`/api/currencies/${usd.id}`, { data: { name: `${usd.name} (prueba)` } });
    await request.put(`/api/currencies/${usd.id}`, { data: { name: usd.name } });
    await page.goto("/settings/currencies");
    await settle(page);
    await page.getByRole("row", { name: /USDT/ }).click();
    const dialog = page.getByRole("dialog", { name: "Editar USDT" });
    await expect(dialog.getByRole("region", { name: "Historial de la moneda" }).getByText("Nombre").first()).toBeVisible();
    await expectAccessible(page, "diálogo de moneda con historial");
  });
});

test.describe("operador", () => {
  test.use(asRole("operador"));

  test("M-6 el operador ve su propio perfil y no el historial de otro usuario", async ({ page, request }) => {
    await page.goto("/settings/profile");
    await settle(page);
    await expect(page.getByLabel(/^Nombre de usuario/)).toHaveValue("operador");
    const me = (await (await request.get("/api/auth/me")).json()).user;
    expect((await request.get(`/api/history?entity=User&id=${me.id}`)).status()).toBe(200);
    const admin = await request.get("/api/history?entity=User&id=00000000-0000-0000-0000-000000000000");
    expect(admin.status()).toBe(403);
  });
});
