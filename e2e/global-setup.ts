import fs from "node:fs";
import path from "node:path";
import { request, type FullConfig } from "@playwright/test";

export const ROLES = {
  admin: { username: "admin", password: process.env.E2E_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "" },
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
  const databaseUrl = process.env.E2E_DATABASE_URL;
  const database = databaseUrl ? new URL(databaseUrl) : null;
  if (!database || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) {
    throw new Error("Configurá E2E_DATABASE_URL con una base local exclusiva para pruebas.");
  }
  if (!ROLES.admin.password) throw new Error("Configurá E2E_ADMIN_PASSWORD.");
  fs.mkdirSync(path.join(__dirname, ".auth"), { recursive: true });
  for (const [role, credentials] of Object.entries(ROLES) as [RoleName, (typeof ROLES)[RoleName]][]) {
    const context = await request.newContext({ baseURL });
    const response = await context.post("/api/auth/login", { data: credentials });
    if (!response.ok()) throw new Error(`No se pudo iniciar sesión como ${role}: ${response.status()} ${await response.text()}`);
    await context.storageState({ path: stateFile(role) });
    await context.dispose();
  }
}
