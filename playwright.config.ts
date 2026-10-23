import { defineConfig, devices } from "@playwright/test";

// Pruebas de punta a punta contra el servidor de desarrollo local y la base Docker con datos de prueba.
// Nunca contra producción: el setup se niega si la base no es la local (ver e2e/global-setup.ts).
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Las pruebas comparten la base: se corren de a una para que no se pisen.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    ...devices["Desktop Chrome"],
    // Chrome instalado: el Chromium que descarga Playwright no arranca en esta máquina (error de
    // configuración en paralelo de Windows) y Edge se cierra después de una descarga.
    channel: process.env.E2E_CHANNEL ?? "chrome",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
