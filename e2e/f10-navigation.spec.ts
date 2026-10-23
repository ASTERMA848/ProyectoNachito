import { asRole, expect, expectAccessible, settle, test } from "./fixtures";

// F10 navegar y volver; rutas por rol y ancho de teléfono.

const SCREENS = ["/", "/operations", "/operations?view=kanban", "/contacts", "/accounts", "/treasury", "/audit", "/settings", "/settings/users", "/settings/currencies"];

test.describe("F10 administrador", () => {
  test.use(asRole("admin"));

  test("F10-H1 inicio, aplicación, sección, registro y migas", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await expectAccessible(page, "S02 inicio");
    await page.getByRole("navigation", { name: "Aplicaciones" }).getByRole("link", { name: "Contactos" }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await page.getByRole("link", { name: "Proveedores" }).click();
    await expect(page).toHaveURL(/filter=role(%3A|:)provider/);
    await settle(page);
    await page.getByRole("article").first().click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
    await page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Contactos" }).click();
    await expect(page).toHaveURL(/\/contacts/);
  });

  test("F10-E2 cada pantalla entra en 390 px sin scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const screen of SCREENS) {
      await page.goto(screen);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `scroll horizontal en ${screen}`).toBeLessThanOrEqual(0);
    }
  });

  test("F10-E4 un formulario nuevo sin historial usa todo el ancho", async ({ page }) => {
    await page.goto("/operations/new?type=single");
    await settle(page);
    const width = await page.getByRole("button", { name: "Registrar venta" }).evaluate((button) => button.closest("[class*=main]")?.getBoundingClientRect().width ?? 0);
    expect(width).toBeGreaterThan(1400);
  });

  test("F10-E3 cada pantalla pasa el análisis de accesibilidad", async ({ page }) => {
    for (const screen of SCREENS) {
      await page.goto(screen);
      await settle(page);
      await expectAccessible(page, screen);
    }
  });
});

test.describe("F10 auditora", () => {
  test.use(asRole("auditora"));

  test("F10-E1 la auditora no ve botones para crear", async ({ page }) => {
    for (const screen of ["/operations", "/contacts", "/settings/users", "/settings/currencies"]) {
      await page.goto(screen);
      await settle(page);
      await expect(page.getByRole("button", { name: /^(Nuevo|Nueva)$/ }), screen).toHaveCount(0);
    }
    await page.goto("/settings/users/new");
    await settle(page);
    await expect(page.getByRole("button", { name: "Guardar" })).toHaveCount(0);
  });
});
