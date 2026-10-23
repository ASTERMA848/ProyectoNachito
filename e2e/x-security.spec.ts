import { asRole, expect, test } from "./fixtures";

// X-1 y X-2: cada escritura de la API rechaza a quien no tiene sesión o permiso.

const WRITES: { method: "post" | "put" | "patch" | "delete"; url: string; allowed: ("admin" | "operador" | "auditora")[] }[] = [
  { method: "post", url: "/api/operations/distributed-sale", allowed: ["admin", "operador"] },
  { method: "post", url: "/api/contacts", allowed: ["admin", "operador"] },
  { method: "post", url: "/api/accounts", allowed: ["admin", "operador"] },
  { method: "post", url: "/api/treasury", allowed: ["admin", "operador"] },
  { method: "post", url: "/api/treasury/transfer", allowed: ["admin", "operador"] },
  { method: "post", url: "/api/tags", allowed: ["admin", "operador"] },
  { method: "post", url: "/api/currencies", allowed: ["admin"] },
  { method: "put", url: "/api/settings", allowed: ["admin"] },
  { method: "post", url: "/api/users", allowed: ["admin"] },
];

test.describe("X-1 sin sesión", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("las lecturas y escrituras de la API piden sesión", async ({ request }) => {
    for (const url of ["/api/operations", "/api/contacts", "/api/accounts", "/api/treasury", "/api/audit", "/api/users", "/api/settings"]) {
      expect((await request.get(url)).status(), url).toBe(401);
    }
    for (const write of WRITES) {
      expect((await request[write.method](write.url, { data: {} })).status(), write.url).toBe(401);
    }
  });
});

for (const role of ["operador", "auditora"] as const) {
  test.describe(`X-1 permisos de ${role}`, () => {
    test.use(asRole(role));

    test(`las escrituras sin permiso devuelven 403 para ${role}`, async ({ request }) => {
      for (const write of WRITES.filter((item) => !item.allowed.includes(role))) {
        expect((await request[write.method](write.url, { data: {} })).status(), `${write.method} ${write.url}`).toBe(403);
      }
    });
  });
}

test.describe("X-2 consola SQL", () => {
  test.use(asRole("auditora"));

  test("no deja leer usuarios ni sesiones ni escribir", async ({ request }) => {
    for (const query of ['SELECT * FROM "User"', 'SELECT "sessionToken" FROM "Session"', 'UPDATE "Currency" SET name = name', "SELECT pg_sleep(1)"]) {
      const response = await request.post("/api/sql", { data: { query } });
      expect(response.ok(), query).toBe(false);
    }
    const ok = await request.post("/api/sql", { data: { query: 'SELECT code FROM "Currency"' } });
    expect(ok.ok()).toBe(true);
  });
});

test.describe("X-3 el operador no ve datos de auditoría", () => {
  test.use(asRole("operador"));

  test("auditoría y consola SQL responden 403", async ({ request }) => {
    expect((await request.get("/api/audit")).status()).toBe(403);
    expect((await request.post("/api/sql", { data: { query: 'SELECT 1' } })).status()).toBe(403);
  });
});
