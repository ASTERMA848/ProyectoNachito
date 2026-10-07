// Comparación e integración contra PostgreSQL. Todos los datos de prueba se revierten.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const raw = fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL\s*=\s*(.*)$/m)?.[1];
if (!raw) throw new Error('DATABASE_URL no encontrada');
process.env.DATABASE_URL = raw.trim().replace(/^["']|["']$/g, '');
function load(source, filename) {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), filename);
  return mod.exports;
}
const helper = load(fs.readFileSync('src/lib/distributed-sale.ts', 'utf8'), path.resolve('src/lib/distributed-sale.ts'));
let legacy;
if (process.argv.includes('--compare')) {
  const source = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`,
    'show', 'd1b4132:src/app/api/operations/distributed-sale/route.ts'], { encoding: 'utf8' });
  const start = source.indexOf('async (tx) => {') + 'async (tx) => {'.length;
  const end = source.indexOf('return { parentOp, childOperations };', start) + 'return { parentOp, childOperations };'.length;
  legacy = load(`export async function save(tx, input) {
    const { providerId, currencyId, items, observations } = input;
    const parsedRate = input.exchangeRate, parsedDate = input.operationDate;
    const originCurrency = { code: input.currencyCode }, destCurrency = { id: input.destCurrencyId };
    ${source.slice(start, end)}
  }`, path.resolve('scratch/legacy.cjs')).save;
}
let queries = 0;
const prisma = new PrismaClient({ log: [{ level: 'query', emit: 'event' }] });
prisma.$on('query', () => queries++);
const rollback = new Error('TEST_ROLLBACK');
async function fixture(tx, count) {
  const prefix = randomUUID();
  const contacts = [0, 1, 2].map(i => ({ id: randomUUID(), name: `PERF-${prefix}-${i}`, isClient: i > 0, isProvider: i === 0 }));
  const currencies = [0, 1].map(i => ({ id: randomUUID(), code: `PERF-${prefix}-${i}`, name: 'Test', symbol: '$' }));
  await tx.contact.createMany({ data: contacts });
  await tx.currency.createMany({ data: currencies });
  return { providerId: contacts[0].id, currencyId: currencies[0].id, destCurrencyId: currencies[1].id,
    currencyCode: currencies[0].code, providerIsPaid: true, exchangeRate: 1000, operationDate: new Date('2026-10-06T12:00:00Z'), observations: 'Prueba reversible',
    items: Array.from({ length: count }, (_, i) => ({ clientId: contacts[1 + i % 2].id, amount: 100 + i,
      exchangeRate: 1010 + i, observations: '', isPaid: true })) };
}
async function snapshot(tx, input) {
  const accounts = await tx.account.findMany({ where: { currencyId: input.currencyId } });
  const balances = [input.providerId, ...Array.from(new Set(input.items.map(i => i.clientId)))].map(id => accounts.find(a => a.contactId === id)?.balance || 0);
  const treasury = await tx.treasuryAccount.findMany({ where: { currencyId: { in: [input.currencyId, input.destCurrencyId] } } });
  const ids = accounts.map(a => a.id);
  const transactions = await tx.transaction.findMany({ where: { accountId: { in: ids } }, orderBy: { date: 'asc' } });
  return { balances, treasury: [input.currencyId, input.destCurrencyId].map(id => treasury.filter(a => a.currencyId === id).reduce((sum, a) => sum + a.balance, 0)),
    debits: transactions.reduce((s, t) => s + t.debit, 0), credits: transactions.reduce((s, t) => s + t.credit, 0), transactions: transactions.length };
}
async function run(label, save, count, checks = false) {
  let result;
  try {
    await prisma.$transaction(async tx => {
      const input = await fixture(tx, count);
      const startQueries = queries, start = performance.now();
      const sale = await save(tx, input);
      result = { label, lines: count, ms: Math.round(performance.now() - start), queries: queries - startQueries };
      // Mismo listado y mismas relaciones, con estrategias de lectura distintas.
      const include = { client: true, provider: true, originCurrency: true, destCurrency: true,
        childOperations: { where: { deletedAt: null }, include: { client: true }, orderBy: { operationNumber: 'asc' } } };
      const lists = [];
      for (const strategy of ['query', 'join']) {
        const listQueries = queries, listStart = performance.now();
        const rows = await tx.operation.findMany({ relationLoadStrategy: strategy,
          where: { id: sale.parentOp.id, deletedAt: null, parentOperationId: null }, include });
        lists.push(rows);
        result[strategy] = { ms: Math.round(performance.now() - listStart), queries: queries - listQueries };
      }
      assert.deepEqual(lists[0], lists[1], 'La lectura agrupada devuelve las mismas relaciones');
      const initial = await snapshot(tx, input);
      result.snapshot = initial;
      assert.deepEqual(initial.balances, [0, 0, 0]);
      assert.equal(initial.treasury[0], 0);
      if (checks) {
        const same = await helper.saveDistributedSale(tx, input, sale.parentOp.id);
        assert.deepEqual(await snapshot(tx, input), initial, 'Editar sin cambios conserva saldos y cantidad de movimientos');
        assert.deepEqual(same.childOperations.map(c => c.id), sale.childOperations.map(c => c.id), 'Conservar IDs');
        const mixed = { ...input, providerIsPaid: false, items: input.items.slice(0, 3).map((i, index) => ({ ...i, isPaid: index === 0 })) };
        const edited = await helper.saveDistributedSale(tx, mixed, sale.parentOp.id);
        assert.equal(edited.parentOp.state, 'PARTIAL');
        assert.equal(await tx.operation.count({ where: { parentOperationId: sale.parentOp.id, deletedAt: null } }), 3);
        const expected = new Map([[mixed.providerId, -mixed.items.reduce((sum, i) => sum + i.amount, 0)]]);
        mixed.items.forEach(i => expected.set(i.clientId, (expected.get(i.clientId) || 0) + (i.isPaid ? 0 : i.amount)));
        const actual = await tx.account.findMany({ where: { currencyId: input.currencyId } });
        actual.forEach(a => assert.equal(a.balance, expected.get(a.contactId) || 0));
        // Agregar filas después de quitar otras no debe chocar con los números de las hijas borradas.
        await helper.saveDistributedSale(tx, input, sale.parentOp.id);
        assert.deepEqual(await snapshot(tx, input), initial);
        const pending = { ...input, providerIsPaid: false, items: input.items.map(i => ({ ...i, isPaid: false })) };
        const pendingSale = await helper.saveDistributedSale(tx, pending, sale.parentOp.id);
        assert.equal(pendingSale.parentOp.state, 'PENDING');
        const pendingSnapshot = await snapshot(tx, pending);
        assert.deepEqual(pendingSnapshot.treasury, [0, 0]);
        assert.equal(pendingSnapshot.transactions, count + 1);
        const customersPaid = { ...input, providerIsPaid: false };
        const unpaidProvider = await helper.saveDistributedSale(tx, customersPaid, sale.parentOp.id);
        assert.equal(unpaidProvider.parentOp.state, 'PARTIAL', 'Todos los clientes cobrados no pagan al proveedor');
        assert.equal(unpaidProvider.parentOp.providerIsPaid, false);
        assert.equal((await snapshot(tx, customersPaid)).balances[0], -input.items.reduce((s, i) => s + i.amount, 0));
        const paidProvider = await helper.saveDistributedSale(tx, { ...pending, providerIsPaid: true }, sale.parentOp.id);
        assert.equal(paidProvider.parentOp.state, 'PARTIAL', 'Proveedor pagado con clientes fiados');
        assert.equal((await snapshot(tx, pending)).balances[0], 0);
        // Moneda origen y destino iguales y proveedor también cliente.
        const sameCurrency = { ...input, destCurrencyId: input.currencyId, items: input.items.map(i => ({ ...i, clientId: input.providerId })) };
        await helper.saveDistributedSale(tx, sameCurrency, sale.parentOp.id);
        assert.deepEqual((await snapshot(tx, sameCurrency)).balances, [0, 0]);
      }
      throw rollback;
    }, { maxWait: 15000, timeout: 180000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log(JSON.stringify(result));
  return result;
}
async function screenshotCase() {
  try {
    await prisma.$transaction(async tx => {
      const input = await fixture(tx, 3);
      const third = await tx.contact.create({ data: { name: 'PERF tercero', isClient: true } });
      input.exchangeRate = 1500;
      input.providerIsPaid = false;
      input.items = [
        { ...input.items[0], amount: 500, exchangeRate: 1520, isPaid: true },
        { ...input.items[1], amount: 600, exchangeRate: 1520, isPaid: false },
        { ...input.items[0], clientId: third.id, amount: 400, exchangeRate: 1520, isPaid: false },
      ];
      const sale = await helper.saveDistributedSale(tx, input);
      assert.equal(sale.parentOp.state, 'PARTIAL');
      const initial = await snapshot(tx, input);
      assert.deepEqual(initial.balances, [-1500, 0, 600, 400]);
      assert.deepEqual(initial.treasury, [0, 760000]);
      await helper.saveDistributedSale(tx, { ...input, providerIsPaid: true }, sale.parentOp.id);
      const paid = await snapshot(tx, input);
      assert.deepEqual(paid.balances, [0, 0, 600, 400]);
      assert.deepEqual(paid.treasury, [0, -1490000]);
      const everyonePaid = { ...input, items: input.items.map(item => ({ ...item, isPaid: true })) };
      await helper.saveDistributedSale(tx, everyonePaid, sale.parentOp.id);
      assert.deepEqual((await snapshot(tx, input)).balances, [-1500, 0, 0, 0]);
      const completed = await helper.saveDistributedSale(tx, { ...everyonePaid, providerIsPaid: true }, sale.parentOp.id);
      assert.equal(completed.parentOp.state, 'COMPLETED');
      assert.deepEqual((await snapshot(tx, input)).balances, [0, 0, 0, 0]);
      assert.deepEqual((await snapshot(tx, input)).treasury, [0, 30000]);
      await helper.reverseSaleLedger(tx, [sale.parentOp.id, ...completed.childOperations.map(c => c.id)]);
      assert.deepEqual((await snapshot(tx, input)).treasury, [0, 0]);
      assert.equal((await snapshot(tx, input)).transactions, 0);
      throw rollback;
    }, { maxWait: 15000, timeout: 180000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('OK: caso 500/600/400 USD, proveedor independiente, caja y reversión.');
}
async function main() {
  const before = {};
  for (const key of ['contact', 'currency', 'operation', 'account', 'transaction', 'treasuryAccount', 'treasuryMovement']) before[key] = await prisma[key].count();
  const old = legacy ? await run('antes', legacy, 10) : null;
  const optimized = await run('despues', helper.saveDistributedSale, 10, true);
  await screenshotCase();
  if (old) assert.deepEqual(optimized.snapshot, old.snapshot, 'Mismos saldos y movimientos que el circuito anterior');
  for (const [key, count] of Object.entries(before)) assert.equal(await prisma[key].count(), count, `Sin datos de prueba persistentes en ${key}`);
  console.log('OK: saldos, edición, pagos mixtos, clientes repetidos, reducción/ampliación y rollback.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
