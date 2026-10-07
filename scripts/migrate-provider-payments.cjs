// Migración atómica: separar proveedor/cliente y corregir la entrega de divisa en ventas existentes.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const raw = fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL\s*=\s*(.*)$/m)?.[1];
if (!raw) throw new Error('DATABASE_URL no encontrada');
process.env.DATABASE_URL = raw.trim().replace(/^["']|["']$/g, '');
const filename = path.resolve('src/lib/distributed-sale.ts');
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpile(fs.readFileSync(filename, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), filename);
const { saveDistributedSale } = mod.exports;
const prisma = new PrismaClient();
async function main() {
  let confirmedPayments;
  if (process.argv.includes('--repair')) {
    const index = process.argv.indexOf('--payments-file');
    if (index < 0 || !process.argv[index + 1]) throw new Error('La reparación requiere --payments-file con pagos confirmados por operación');
    confirmedPayments = JSON.parse(fs.readFileSync(process.argv[index + 1], 'utf8'));
    if (!confirmedPayments || Array.isArray(confirmedPayments) || !Object.keys(confirmedPayments).length ||
      Object.values(confirmedPayments).some(value => typeof value !== 'boolean')) throw new Error('Formato esperado: {"OP-000001": true, "OP-000004": false}');
  }
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72641003)`;
    const [column] = await tx.$queryRaw`SELECT COUNT(*)::integer AS count FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Operation' AND column_name = 'providerIsPaid'`;
    if (!column.count) {
      // Los registros anteriores quedan NULL: no inventar su condición de pago.
      await tx.$executeRaw`ALTER TABLE "Operation" ADD COLUMN "providerIsPaid" BOOLEAN`;
      await tx.$executeRaw`ALTER TABLE "Operation" ALTER COLUMN "providerIsPaid" SET DEFAULT false`;
    }
    if (!process.argv.includes('--repair')) {
      console.log('Campo independiente creado. No se modificaron ventas, saldos ni movimientos existentes.');
      return;
    }
    // Nunca inferir pagos reales desde el antiguo campo que dependía de los clientes.
    const sales = await tx.operation.findMany({ where: { operationNumber: { in: Object.keys(confirmedPayments) }, type: 'DISTRIBUTED_SALE', deletedAt: null, state: { not: 'CANCELED' } },
      include: { originCurrency: true, childOperations: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } } });
    if (sales.length !== Object.keys(confirmedPayments).length) throw new Error('Alguna operación confirmada no existe o está cancelada');
    for (const sale of sales) {
      if (!sale.childOperations.length) continue;
      sale.childOperations.sort((a, b) => a.operationNumber.localeCompare(b.operationNumber, undefined, { numeric: true }));
      const input = { providerId: sale.providerId, currencyId: sale.originCurrencyId, destCurrencyId: sale.destCurrencyId,
        currencyCode: sale.originCurrency.code, exchangeRate: sale.exchangeRate, operationDate: sale.operationDate,
        observations: sale.observations, providerIsPaid: confirmedPayments[sale.operationNumber],
        items: sale.childOperations.map(c => ({ clientId: c.clientId, amount: c.originAmount, exchangeRate: c.exchangeRate, observations: c.observations, isPaid: c.isPaid })) };
      const result = await saveDistributedSale(tx, input, sale.id);
      await tx.auditLog.create({ data: { action: 'UPDATE', entity: 'Operation', entityId: sale.id,
        oldValues: JSON.stringify({ state: sale.state, isPaid: sale.isPaid }),
        newValues: JSON.stringify({ state: result.parentOp.state, providerIsPaid: input.providerIsPaid,
          reason: 'Separar pago proveedor de cobros; registrar recepción y entrega USD incluso fiados' }) } });
    }
    console.log('Migración aplicada; ventas revisadas: ' + sales.length);
  }, { maxWait: 15000, timeout: 120000 });
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
