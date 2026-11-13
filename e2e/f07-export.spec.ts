import fs from "node:fs";
import { asRole, expect, settle, test } from "./fixtures";

// F07 acciones masivas y exportación.
test.use(asRole("admin"));

test("F07-H1 y E1 exportar contactos seleccionados; una celda que empieza con = sale como texto", async ({ page, request }) => {
  const name = `=1+1 Prueba ${Date.now().toString(36)}`;
  const created = await request.post("/api/contacts", { data: { name, isClient: true } });
  expect(created.ok()).toBe(true);
  await page.goto(`/contacts?view=list&q=${encodeURIComponent(name)}`);
  await settle(page);
  await page.getByRole("checkbox", { name: `Seleccionar ${name}` }).check();
  await page.getByRole("button", { name: "Acciones" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Exportar a CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^contactos-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = fs.readFileSync((await download.path())!, "utf8");
  // Se borra antes de terminar: si la descarga sigue abierta al cerrar la página, la prueba siguiente falla.
  await download.delete();
  expect(text.split(/\r?\n/)).toHaveLength(2);
  // La celda no puede quedar como fórmula para la planilla.
  expect(text).not.toMatch(/(^|;)"?=1\+1/m);
  expect(text).toContain("Prueba");
  // No dejar el contacto de prueba para que no aparezca en otras pruebas ni en la lista real.
  await request.delete(`/api/contacts/${(await created.json()).id}`);
});
