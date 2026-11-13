import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";

const WINDOW_MS = 15 * 60 * 1000;
const digestKey = (key: string) => createHash("sha256").update(key).digest("hex");

export async function consumeAuthAttempt(key: string, limit: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);
  const digest = digestKey(key);
  const [attempt] = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "LoginAttempt" ("key", "count", "expiresAt")
    VALUES (${digest}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginAttempt"."expiresAt" <= ${now} THEN 1 ELSE LEAST("LoginAttempt"."count" + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "LoginAttempt"."expiresAt" END
    RETURNING "count", "expiresAt"
  `;
  // Limpieza amortizada por el índice, incluso si nadie vuelve a usar una clave.
  if (Math.random() < 0.01) await prisma.loginAttempt.deleteMany({ where: { expiresAt: { lte: now } } });
  return attempt.count > limit ? Math.max(1, Math.ceil((attempt.expiresAt.getTime() - now.getTime()) / 1000)) : 0;
}

export function clearAuthAttempts(key: string, db: Pick<Prisma.TransactionClient, "loginAttempt"> = prisma) {
  return db.loginAttempt.deleteMany({ where: { key: digestKey(key) } });
}
