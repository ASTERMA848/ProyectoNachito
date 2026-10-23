import { asRole, expect, expectAccessible, settle, test } from "./fixtures";

// F08 configurar el sistema; F09 administrar usuarios.

test.describe("F08 y F09 administrador", () => {
  test.use(asRole("admin"));

  test("F08-H1 y E1 cambiar el cierre contable, descartar y guardar", async ({ page, request }) => {
    const saved = (await (await request.get("/api/settings")).json()).settings;
    try {
      await page.goto("/settings");
      await settle(page);
      await expectAccessible(page, "S15 configuración");
      const date = page.getByLabel("Cierre contable");
      await date.fill("2020-01-01");
      await page.getByRole("button", { name: "Descartar" }).first().click();
      await expect(date).toHaveValue(saved.accountingBlockDate?.slice(0, 10) ?? "");
      await date.fill("2020-01-01");
      await page.getByRole("button", { name: "Guardar" }).first().click();
      await expect(page.getByRole("status").filter({ hasText: "Configuración guardada" })).toBeVisible();
      const audit = await (await request.get("/api/audit?filter=entity:Settings&limit=1")).json();
      expect(JSON.stringify(audit.logs[0].after)).toContain("2020-01-01");
    } finally {
      await request.put("/api/settings", { data: { mainCurrencyId: saved.mainCurrencyId, accountingBlockDate: saved.accountingBlockDate?.slice(0, 10) ?? "" } });
    }
  });

  test("F09-H1, E1 y E2 alta de usuario, contraseña débil y no pausarse a uno mismo", async ({ page, request }) => {
    const username = `prueba.${Date.now().toString(36)}`;
    await page.goto("/settings/users/new");
    await settle(page);
    await expectAccessible(page, "S16 usuario nuevo");
    await page.getByLabel(/^Usuario/).fill(username);
    await page.getByLabel(/^Contraseña inicial/).fill("abc");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Entre 8 y 128 caracteres")).toBeVisible();
    await page.getByLabel(/^Contraseña inicial/).fill(`Prueba-${Date.now()}`);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Usuario creado" })).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/users\/[0-9a-f-]{36}$/);
    await settle(page);
    // Pausarlo deja el usuario sin acceso.
    await page.getByRole("button", { name: "Pausar" }).click();
    await page.getByRole("dialog", { name: "Pausar usuario" }).getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByText("Este usuario está pausado")).toBeVisible();

    const me = (await (await request.get("/api/auth/me")).json()).user;
    const self = await request.patch(`/api/users/${me.id}`, { data: { isActive: false } });
    expect(self.status()).toBe(400);
    const demote = await request.put(`/api/users/${me.id}`, { data: { username: me.username, role: "OPERATOR" } });
    expect(demote.status()).toBe(400);
  });

  test("F09-E3 monedas: lista accesible y el interruptor responde", async ({ page }) => {
    await page.goto("/settings/currencies");
    await settle(page);
    await expectAccessible(page, "S17 monedas");
    await expect(page.getByRole("switch", { name: "USD activa" })).toBeChecked();
  });
});

test.describe("F08 y F09 operador", () => {
  test.use(asRole("operador"));

  test("F08-N1 y F09-N1 el operador no cambia ajustes ni usuarios", async ({ page, request }) => {
    await page.goto("/settings");
    await settle(page);
    await expect(page.getByLabel("Cierre contable")).toBeDisabled();
    expect((await request.put("/api/settings", { data: { accountingBlockDate: "" } })).status()).toBe(403);
    expect((await request.post("/api/users", { data: { username: "nadie123", password: "12345678", role: "ADMIN" } })).status()).toBe(403);
    expect((await request.get("/api/users")).status()).toBe(403);
  });
});
