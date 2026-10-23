import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { stateFile, type RoleName } from "./global-setup";

export { expect };

type Fixtures = { guard: void };

// Cada prueba falla si la página registra un error de consola o si el servidor responde 5xx.
// "Failed to load resource" se ignora: el navegador lo escribe para cualquier 4xx, que muchas pruebas buscan a propósito.
export const test = base.extend<Fixtures>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) problems.push(`consola: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`excepción: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() >= 500) problems.push(`${response.status()} en ${response.url()}`);
      });
      await use();
      expect(problems, problems.join("\n")).toEqual([]);
    },
    { auto: true },
  ],
});

export const asRole = (role: RoleName) => ({ storageState: stateFile(role) });

// Análisis de accesibilidad de la pantalla: fallan las violaciones graves y críticas de WCAG A y AA.
export async function expectAccessible(page: Page, screen: string) {
  // @axe-core/playwright trae sus propios tipos de Playwright, más nuevos: el objeto es el mismo.
  const result = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withTags(["wcag2a", "wcag2aa"])
    // Sin el modo clásico axe abre y cierra una página auxiliar, y ese cierre a veces llega tarde y falla la prueba.
    .setLegacyMode(true)
    .analyze();
  const serious = result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${screen}: ${violation.id} (${violation.impact}) en ${violation.nodes.length} nodos: ${violation.nodes[0]?.target.join(" ")}`);
  expect(serious, serious.join("\n")).toEqual([]);
}

// Espera a que la lista o la ficha terminen de cargar (sin "aria-busy" en la página).
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
