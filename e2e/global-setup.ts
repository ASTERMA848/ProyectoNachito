import fs from "node:fs";
import path from "node:path";
import { request, type FullConfig } from "@playwright/test";

export const ROLES = {
  admin: { username: "admin", password: "admin" },
  operador: { username: "operador", password: "operador1234" },
  auditora: { username: "auditora", password: "auditora1234" },
} as const;
export type RoleName = keyof typeof ROLES;

export const stateFile = (role: RoleName) => path.join(__dirname, ".auth", `${role}.json`);

// Inicia sesión una vez por rol y guarda las cookies. Los usuarios existen solo en la base local
// (prisma/seed.js y scripts/seed-demo.cjs).
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL)) throw new Error(`Las pruebas solo corren contra localhost, no ${baseURL}`);
  const envFile = path.join(__dirname, "..", ".env.development.local");
  if (!fs.existsSync(envFile) || !/localhost:5434/.test(fs.readFileSync(envFile, "utf8"))) {
    throw new Error("Falta .env.development.local apuntando a la base Docker local (localhost:5434)");
  }
  fs.mkdirSync(path.join(__dirname, ".auth"), { recursive: true });
  for (const [role, credentials] of Object.entries(ROLES) as [RoleName, (typeof ROLES)[RoleName]][]) {
    // El login limita 5 intentos por dirección cada 15 minutos y el servidor de desarrollo guarda la
    // cuenta en memoria: cada corrida usa una dirección local propia para no quedar bloqueada.
    const context = await request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `10.77.${Date.now() % 250}.${Math.floor(Math.random() * 250)}` } });
    const response = await context.post("/api/auth/login", { data: credentials });
    if (!response.ok()) throw new Error(`No se pudo iniciar sesión como ${role}: ${response.status()} ${await response.text()}`);
    await context.storageState({ path: stateFile(role) });
    await context.dispose();
  }
}
