import { asRole, expect, expectAccessible, settle, test } from "./fixtures";

// Imprescindible #3 de replica-entrepreneur (replica/fixes.md): un recorrido corto de primeros
// pasos para un usuario u operador nuevo, con cada marca verificada contra la base (nunca
// autoreportada) y que desaparece solo cuando la agencia ya está en marcha.

test("X-8 el endpoint de onboarding exige autenticación", async ({ request }) => {
  const response = await request.get("/api/onboarding");
  expect(response.status()).toBe(401);
});

test.describe("inicio (administrador)", () => {
  test.use(asRole("admin"));

  test("X-9 admin: ya con datos cargados, el checklist de primeros pasos no aparece", async ({ page, request }) => {
    const state = await request.get("/api/onboarding").then((response) => response.json());
    // La base de pruebas ya tiene operaciones, movimientos y más de un usuario: las 5 banderas
    // deberían estar en true, y entonces el checklist no debería mostrarse.
    expect(state).toEqual({
      hasOperation: true,
      hasAccountMovement: true,
      hasTreasuryMovement: true,
      hasMainCurrency: true,
      hasTeam: true,
    });

    await page.goto("/");
    await settle(page);
    await expect(page.getByRole("heading", { name: "Primeros pasos" })).toHaveCount(0);
  });
});

test.describe("inicio (auditora)", () => {
  test.use(asRole("auditora"));

  test("X-10 auditora: ve una guía de referencia sin marcas de progreso", async ({ page }) => {
    await page.goto("/");
    await settle(page);

    const heading = page.getByRole("heading", { name: "Primeros pasos" });
    await expect(heading).toBeVisible();
    await expect(page.getByRole("link", { name: /Revisá las operaciones/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mirá la auditoría/ })).toBeVisible();

    await expectAccessible(page, "inicio-auditora");
  });
});
