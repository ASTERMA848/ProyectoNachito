import type { Page } from "@playwright/test";
import { asRole, settle, test } from "./fixtures";

// Una captura por pantalla del recon (replica/recon.md), en los dos tamaños que usa replica-diff.
// Se guardan en replica/clone-screens/S07.png y S07-mobile.png.
const OUT = "replica/clone-screens";
const SIZES = [
  { suffix: "", width: 1440, height: 900 },
  { suffix: "-mobile", width: 390, height: 844 },
];

type Screen = { id: string; path: string; prepare?: (page: Page) => Promise<void> };

const SCREENS: Screen[] = [
  { id: "S02", path: "/" },
  { id: "S03", path: "/operations" },
  { id: "S04", path: "/operations?groupBy=state" },
  { id: "S05", path: "/operations?view=kanban" },
  { id: "S06", path: "/contacts" },
  { id: "S08", path: "/contacts", prepare: async (page) => { await page.getByRole("article").first().click(); await page.waitForURL(/\/contacts\/[0-9a-f-]{36}$/); } },
  // La ficha de una venta distribuida (la ruta se completa con la primera que devuelve la API).
  { id: "S07", path: "distributed-sale" },
  { id: "S09", path: "/operations", prepare: async (page) => { await page.getByRole("button", { name: "Opciones de búsqueda" }).click(); } },
  { id: "S13", path: "/treasury" },
  { id: "S14", path: "/audit" },
  { id: "S15", path: "/settings" },
  { id: "S16", path: "/settings/users" },
  { id: "S17", path: "/settings/currencies" },
];

test.describe("capturas con sesión", () => {
  test.use(asRole("admin"));
  for (const screen of SCREENS) {
    test(`${screen.id} ${screen.path}`, async ({ page }) => {
      for (const size of SIZES) {
        await page.setViewportSize({ width: size.width, height: size.height });
        let path = screen.path;
        if (path === "distributed-sale") {
          const list = await (await page.request.get("/api/operations?filter=type:distributed&limit=1")).json();
          path = `/operations/${list.operations[0].id}`;
        }
        await page.goto(path);
        await settle(page);
        if (screen.prepare) {
          await screen.prepare(page);
          await settle(page);
        }
        await page.screenshot({ path: `${OUT}/${screen.id}${size.suffix}.png` });
      }
    });
  }
});

test.describe("captura sin sesión", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("S01 /login", async ({ page }) => {
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/login");
      await page.screenshot({ path: `${OUT}/S01${size.suffix}.png` });
    }
  });
});
