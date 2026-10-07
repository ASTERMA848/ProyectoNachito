// Integración PostgreSQL: todos los movimientos y cajas de prueba se revierten.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const raw = fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL\s*=\s*(.*)$/m)?.[1];
if (!raw) throw new Error('DATABASE_URL no encontrada');
process.env.DATABASE_URL = raw.trim().replace(/^["']|["']$/g, '');
const filename = path.resolve('src/lib/manual-treasury.ts');
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpile(fs.readFileSync(filename, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), filename);
const { recordManualTreasuryMovement: record, parseTreasuryInput } = mod.exports;
const prisma = new PrismaClient();
const rollback = new Error('TEST_ROLLBACK');

async function main() {
  for (const amount of [0, -1, NaN, Infinity, '12', null]) {
    assert.throws(() => parseTreasuryInput({ accountId: 'test', type: 'INCOME', amount, reason: 'Aporte' }));
  }
  let ids;
  try {
    await prisma.$transaction(async tx => {
      const user = await tx.user.findFirstOrThrow({ where: { isActive: true } });
      const currency = await tx.currency.create({ data: { code: `TEST-${randomUUID()}`, name: 'Test reversible', symbol: '$', decimals: 2 } });
      const secondCurrency = await tx.currency.create({ data: { code: `TEST-${randomUUID()}`, name: 'Test reversible seis decimales', symbol: '$', decimals: 6 } });
      const account = await tx.treasuryAccount.create({ data: { name: 'TEST reversible', type: 'CASH', currencyId: currency.id, balance: 100 } });
      const other = await tx.treasuryAccount.create({ data: { name: 'TEST otra moneda', type: 'WALLET', currencyId: secondCurrency.id } });
      ids = [account.id, other.id];
      const income = await record(tx, { accountId: account.id, type: 'INCOME', amount: 50.25, reason: '  Aporte de prueba  ' }, user.id);
      assert.equal(income.account.balance, 150.25);
      assert.equal(income.movement.concept, 'Aporte de prueba');
      assert.equal(income.movement.operationId, null);
      const expense = await record(tx, { accountId: account.id, type: 'EXPENSE', amount: 30.25, reason: 'Retiro de prueba' }, user.id);
      assert.equal(expense.account.balance, 120);
      await assert.rejects(record(tx, { accountId: account.id, type: 'EXPENSE', amount: 121, reason: 'Sin saldo' }, user.id), /Saldo insuficiente/);
      await assert.rejects(record(tx, { accountId: account.id, type: 'INCOME', amount: 1.001, reason: 'Precisión' }, user.id), /decimales/);
      await assert.rejects(record(tx, { accountId: account.id, type: 'INCOME', amount: 1, reason: '  ' }, user.id), /motivo/);
      const precise = await record(tx, { accountId: other.id, type: 'INCOME', amount: 0.123456, reason: 'Otra moneda' }, user.id);
      assert.equal(precise.account.balance, 0.123456);
      assert.equal((await tx.treasuryAccount.findUniqueOrThrow({ where: { id: account.id } })).balance, 120);
      assert.equal(await tx.treasuryMovement.count({ where: { treasuryAccountId: { in: ids } } }), 3);
      const audit = await tx.auditLog.findFirstOrThrow({ where: { entityId: expense.movement.id } });
      assert.equal(audit.userId, user.id);
      assert.equal(JSON.parse(audit.oldValues).balance, 150.25);
      assert.equal(JSON.parse(audit.newValues).reason, 'Retiro de prueba');
      await tx.treasuryAccount.update({ where: { id: other.id }, data: { isActive: false } });
      await assert.rejects(record(tx, { accountId: other.id, type: 'INCOME', amount: 1, reason: 'Inactiva' }, user.id), /disponibles/);
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await prisma.treasuryAccount.count({ where: { id: { in: ids } } }), 0);
  assert.equal(await prisma.treasuryMovement.count({ where: { treasuryAccountId: { in: ids } } }), 0);
  console.log('OK: ingresos, extracciones, motivo, auditoría, monedas, precisión y validaciones. Datos de prueba revertidos.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
