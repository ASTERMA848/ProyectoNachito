import type { Page } from "@playwright/test";
import { expect, expectAccessible, settle, test } from "./fixtures";
import { ROLES } from "./global-setup";

// F12 iniciar y cerrar sesión. Sin sesión guardada: cada prueba entra por la pantalla de login.
test.use({ storageState: { cookies: [], origins: [] } });

async function login(page: Page, username: string, password: string) {
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("F12-H1 entrar y salir", async ({ page }) => {
  await page.goto("/login");
  await expectAccessible(page, "S01 inicio de sesión");
  await login(page, ROLES.admin.username, ROLES.admin.password);
  await expect(page).toHaveURL(/\/$/);
  await settle(page);
  await page.getByRole("button", { name: /Menú de admin/ }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/operations");
  await expect(page).toHaveURL(/\/login/);
});

test("F12-N1 contraseña incorrecta muestra un mensaje genérico", async ({ page }) => {
  await page.goto("/login");
  await login(page, ROLES.admin.username, "no-es-la-clave");
  await expect(page.locator("#login-error")).toHaveText("Usuario o contraseña incorrectos");
  await login(page, "usuario-que-no-existe", "no-es-la-clave");
  await expect(page.locator("#login-error")).toHaveText("Usuario o contraseña incorrectos");
});

test("F12-E1 sin sesión, entrar devuelve a la pantalla pedida", async ({ page }) => {
  await page.goto("/contacts?filter=role:provider");
  await expect(page).toHaveURL(/\/login\?next=/);
  await login(page, ROLES.operador.username, ROLES.operador.password);
  await expect(page).toHaveURL(/\/contacts\?filter=role(%3A|:)provider/);
  await settle(page);
});

test("F12-E2 una redirección a otro sitio termina en Inicio", async ({ page, baseURL }) => {
  await page.goto(`/login?next=${encodeURIComponent("/\\otro-sitio.test/robar")}`);
  await login(page, ROLES.admin.username, ROLES.admin.password);
  await expect(page).toHaveURL(new URL("/", baseURL).href);
});

test("F12-E3 demasiados intentos fallidos bloquean por un rato", async ({ page }) => {
  await page.goto("/login");
  const username = `prueba-limite-${Date.now()}`;
  for (let attempt = 0; attempt < 5; attempt += 1) await login(page, username, `mala-${attempt}`);
  await login(page, username, "mala-final");
  await expect(page.locator("#login-error")).toHaveText(/Demasiados intentos/);
});
