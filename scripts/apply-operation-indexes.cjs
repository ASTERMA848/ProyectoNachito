// Índices aditivos: no borra registros ni cambia columnas.
const fs = require('node:fs');
const { PrismaClient, Prisma } = require('@prisma/client');
const raw = fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL\s*=\s*(.*)$/m)?.[1];
if (!raw) throw new Error('DATABASE_URL no encontrada');
process.env.DATABASE_URL = raw.trim().replace(/^["']|["']$/g, '');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "Operation_deletedAt_parentOperationId_createdAt_id_idx"
    ON "Operation" ("deletedAt", "parentOperationId", "createdAt", id)`);
  await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "Transaction_operationId_idx" ON "Transaction" ("operationId")`);
  await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "TreasuryMovement_operationId_idx" ON "TreasuryMovement" ("operationId")`);
  await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "TreasuryAccount_currencyId_idx" ON "TreasuryAccount" ("currencyId")`);
  console.log('Índices de operaciones aplicados.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
