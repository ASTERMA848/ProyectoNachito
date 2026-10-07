import { randomUUID } from "node:crypto";
import { Prisma, Operation } from "@prisma/client";

type Tx = Prisma.TransactionClient;
export type SaleItem = { clientId: string; amount: number; exchangeRate: number; observations: string | null; isPaid: boolean };
export type SaleInput = {
  providerId: string; currencyId: string; destCurrencyId: string; currencyCode: string;
  exchangeRate: number; operationDate: Date; observations: string | null; providerIsPaid: boolean; items: SaleItem[];
  operationType?: "DISTRIBUTED_SALE" | "SINGLE_SALE";
};
export class SaleValidationError extends Error {}

// Serializa la numeración sin contar todas las operaciones hijas ni reutilizar números borrados.
export async function nextOperationNumber(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(72641001)`;
  const [row] = await tx.$queryRaw<{ next: number }[]>`
    SELECT COALESCE(MAX(substring("operationNumber" from '^OP-([0-9]+)')::integer), 0) + 1 AS next
    FROM "Operation" WHERE "parentOperationId" IS NULL`;
  return `OP-${String(row.next).padStart(6, "0")}`;
}

export async function reverseSaleLedger(tx: Tx, ids: string[]) {
  // Revertir una vez por cuenta, en lugar de leer y actualizar por movimiento.
  await tx.$executeRaw`
    UPDATE "Account" a SET balance = a.balance + r.amount
    FROM (SELECT "accountId", SUM(debit - credit) AS amount FROM "Transaction"
      WHERE "operationId" IN (${Prisma.join(ids)}) GROUP BY "accountId") r
    WHERE a.id = r."accountId"`;
  await tx.$executeRaw`
    UPDATE "TreasuryAccount" a SET balance = a.balance + r.amount, "updatedAt" = NOW()
    FROM (SELECT "treasuryAccountId", SUM(CASE WHEN type = 'INCOME' THEN -amount ELSE amount END) AS amount
      FROM "TreasuryMovement" WHERE "operationId" IN (${Prisma.join(ids)}) GROUP BY "treasuryAccountId") r
    WHERE a.id = r."treasuryAccountId"`;
  await tx.transaction.deleteMany({ where: { operationId: { in: ids } } });
  await tx.treasuryMovement.deleteMany({ where: { operationId: { in: ids } } });
}

export async function applySaleLedger(tx: Tx, parent: Operation, children: Operation[], input: SaleInput) {
  const contactIds = Array.from(new Set([input.providerId, ...input.items.map(i => i.clientId)])).sort();
  await tx.account.createMany({
    data: contactIds.map(contactId => ({ id: randomUUID(), contactId, currencyId: input.currencyId, balance: 0 })),
    skipDuplicates: true,
  });
  // Bloquear y leer los saldos juntos evita sobrescribir cobros concurrentes.
  const accounts = await tx.$queryRaw<{ id: string; contactId: string; balance: number }[]>`
    SELECT id, "contactId", balance FROM "Account"
    WHERE "currencyId" = ${input.currencyId} AND "contactId" IN (${Prisma.join(contactIds)})
    ORDER BY id FOR UPDATE`;
  const accountMap = new Map(accounts.map(a => [a.contactId, a]));
  const transactions: Prisma.TransactionCreateManyInput[] = [];
  const record = (contactId: string, op: Operation, debit: number, credit: number, concept: string, observations: string) => {
    const account = accountMap.get(contactId)!;
    account.balance += credit - debit;
    transactions.push({ id: randomUUID(), accountId: account.id, operationId: op.id, debit, credit,
      balance: account.balance, concept, observations, date: new Date() });
  };
  record(input.providerId, parent, parent.originAmount, 0, `Compra de divisa (Op Agrupadora: ${parent.operationNumber})`,
    `Cotización Proveedor: ${input.exchangeRate}. Costo ARS: $${parent.destAmount.toLocaleString("es-AR")}`);
  if (input.providerIsPaid) record(input.providerId, parent, 0, parent.originAmount,
    `Pago al contado registrado (Op: ${parent.operationNumber})`, "Cancelación de deuda por compra");
  children.forEach((child, index) => {
    const item = input.items[index];
    record(item.clientId, child, 0, child.originAmount, `Venta divisa a cliente (Op: ${child.operationNumber})`,
      `Cotización Venta: ${item.exchangeRate}. Total ARS: $${child.destAmount.toLocaleString("es-AR")}. ${item.observations || ""}`);
    if (item.isPaid) record(item.clientId, child, child.originAmount, 0,
      `Pago al contado registrado (Op: ${child.operationNumber})`, `Cancelación de deuda por venta cobrada en el acto - ${item.observations || ""}`);
  });
  await tx.$executeRaw`
    UPDATE "Account" a SET balance = v.balance FROM (VALUES
      ${Prisma.join(accounts.map(a => Prisma.sql`(${a.id}::text, ${a.balance}::double precision)`))}
    ) AS v(id, balance) WHERE a.id = v.id`;
  await tx.transaction.createMany({ data: transactions });

  const paidChildren = children.filter(c => c.isPaid);
  // Una cuenta por moneda seleccionada una sola vez para todo el lote.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(72641002)`;
  const currencyIds = Array.from(new Set([input.currencyId, input.destCurrencyId]));
  const existing = await tx.treasuryAccount.findMany({ where: { currencyId: { in: currencyIds }, type: "CASH", isActive: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const missing = currencyIds.filter(id => !existing.some(a => a.currencyId === id));
  if (missing.length) {
    const now = new Date();
    const created = missing.map(currencyId => ({ id: randomUUID(), currencyId, name: currencyId === input.currencyId ? `Caja ${input.currencyCode}` : "Caja Base",
      type: "CASH", balance: 0, isActive: true, createdAt: now, updatedAt: now }));
    await tx.treasuryAccount.createMany({ data: created });
    existing.push(...created);
  }
  const byCurrency = new Map(currencyIds.map(id => [id, existing.find(a => a.currencyId === id)!]));
  const movements: Prisma.TreasuryMovementCreateManyInput[] = [];
  const deltas = new Map<string, number>();
  const movement = (currencyId: string, op: Operation, type: "INCOME" | "EXPENSE", amount: number, concept: string) => {
    const id = byCurrency.get(currencyId)!.id;
    deltas.set(id, (deltas.get(id) || 0) + (type === "INCOME" ? amount : -amount));
    movements.push({ id: randomUUID(), treasuryAccountId: id, operationId: op.id, type, amount, concept });
  };
  // La divisa se recibe del proveedor y se entrega a TODOS los clientes, incluso fiados.
  movement(input.currencyId, parent, "INCOME", parent.originAmount, `Recepción divisa del proveedor Op ${parent.operationNumber}`);
  children.forEach(child => {
    movement(input.currencyId, child, "EXPENSE", child.originAmount, `Entrega divisa a cliente Op ${child.operationNumber}`);
  });
  if (input.providerIsPaid) {
    movement(input.destCurrencyId, parent, "EXPENSE", parent.destAmount, `Egreso base por Op ${parent.operationNumber}`);
  }
  paidChildren.forEach(child => {
    movement(input.destCurrencyId, child, "INCOME", child.destAmount, `Ingreso base por venta Op ${child.operationNumber}`);
  });
  await tx.$executeRaw`
    UPDATE "TreasuryAccount" a SET balance = a.balance + v.amount, "updatedAt" = NOW() FROM (VALUES
      ${Prisma.join(Array.from(deltas).sort(([a], [b]) => a.localeCompare(b)).map(([id, amount]) => Prisma.sql`(${id}::text, ${amount}::double precision)`))}
    ) AS v(id, amount) WHERE a.id = v.id`;
  await tx.treasuryMovement.createMany({ data: movements });
}

export async function saveDistributedSale(tx: Tx, input: SaleInput, parentId?: string) {
  if (input.operationType === "SINGLE_SALE" && input.items.length !== 1)
    throw new SaleValidationError("La operación 1 a 1 debe tener exactamente un movimiento de cliente.");
  let existing: (Operation & { childOperations: Operation[] }) | null = null;
  if (parentId) {
    // Leer después del bloqueo: dos ediciones concurrentes no revierten el mismo lote dos veces.
    await tx.$queryRaw`SELECT id FROM "Operation" WHERE id = ${parentId} FOR UPDATE`;
    existing = await tx.operation.findFirst({ where: { id: parentId, type: { in: ["DISTRIBUTED_SALE", "SINGLE_SALE"] }, parentOperationId: null, deletedAt: null },
      include: { childOperations: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } });
    if (!existing) throw new Error("Operación distribuida no encontrada");
    if ((existing.type === "SINGLE_SALE" && input.items.length !== 1) || (input.operationType && input.operationType !== existing.type))
      throw new SaleValidationError("No se puede cambiar el tipo de operación. La operación 1 a 1 admite un solo movimiento de cliente.");
    existing.childOperations.sort((a, b) => a.operationNumber.localeCompare(b.operationNumber, undefined, { numeric: true }));
    await reverseSaleLedger(tx, [parentId, ...existing.childOperations.map(c => c.id)]);
  }
  const total = input.items.reduce((sum, item) => sum + item.amount, 0);
  const paid = input.items.filter(i => i.isPaid).length;
  const operationType = existing?.type || input.operationType || "DISTRIBUTED_SALE";
  const data = { providerId: input.providerId, clientId: operationType === "SINGLE_SALE" ? input.items[0].clientId : null, originCurrencyId: input.currencyId, destCurrencyId: input.destCurrencyId,
    originAmount: total, destAmount: total * input.exchangeRate, exchangeRate: input.exchangeRate,
    operationDate: input.operationDate, observations: input.observations,
    state: paid === input.items.length && input.providerIsPaid ? "COMPLETED" : paid || input.providerIsPaid ? "PARTIAL" : "PENDING",
    isPaid: paid === input.items.length, providerIsPaid: input.providerIsPaid };
  const parent = existing
    ? await tx.operation.update({ where: { id: existing.id }, data })
    : await tx.operation.create({ data: { ...data, id: randomUUID(), operationNumber: await nextOperationNumber(tx), type: operationType } });
  const now = new Date();
  const children: Operation[] = input.items.map((item, index) => ({ ...parent,
    id: existing?.childOperations[index]?.id || randomUUID(),
    operationNumber: existing?.childOperations[index]?.operationNumber || `${parent.operationNumber}-${index + 1}`,
    type: "DISTRIBUTED_SALE_ITEM", parentOperationId: parent.id, clientId: item.clientId, providerIsPaid: false,
    originAmount: item.amount, destAmount: item.amount * item.exchangeRate, exchangeRate: item.exchangeRate,
    observations: item.observations, state: item.isPaid ? "COMPLETED" : "PENDING", isPaid: item.isPaid,
    deletedAt: null, createdAt: existing?.childOperations[index]?.createdAt || now, updatedAt: now }));
  if (existing) {
    const excess = existing.childOperations.slice(children.length);
    if (excess.length) await tx.$executeRaw`
      UPDATE "Operation" SET "deletedAt" = ${now}, "updatedAt" = ${now},
        "operationNumber" = "operationNumber" || '-DEL-' || id WHERE id IN (${Prisma.join(excess.map(c => c.id))})`;
    // Una sentencia para todas las hijas existentes y nuevas; conservar IDs y adjuntos.
    await tx.$executeRaw`
      INSERT INTO "Operation" (id, "operationNumber", type, "parentOperationId", "clientId", "providerId",
        "originCurrencyId", "destCurrencyId", "originAmount", "destAmount", "exchangeRate", "operationDate",
        "isPaid", observations, state, "createdAt", "updatedAt", "deletedAt")
      SELECT id, "operationNumber", type, "parentOperationId", "clientId", "providerId", "originCurrencyId", "destCurrencyId",
        "originAmount", "destAmount", "exchangeRate", "operationDate", "isPaid", observations, state, "createdAt", "updatedAt", "deletedAt"
      FROM jsonb_populate_recordset(NULL::"Operation", ${JSON.stringify(children)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET "clientId" = EXCLUDED."clientId", "providerId" = EXCLUDED."providerId",
        "originCurrencyId" = EXCLUDED."originCurrencyId", "destCurrencyId" = EXCLUDED."destCurrencyId",
        "originAmount" = EXCLUDED."originAmount", "destAmount" = EXCLUDED."destAmount", "exchangeRate" = EXCLUDED."exchangeRate",
        "operationDate" = EXCLUDED."operationDate", "isPaid" = EXCLUDED."isPaid", observations = EXCLUDED.observations,
        state = EXCLUDED.state, "updatedAt" = EXCLUDED."updatedAt"`;
  } else {
    await tx.operation.createMany({ data: children });
  }
  await applySaleLedger(tx, parent, children, input);
  return { parentOp: parent, childOperations: children };
}
