import { randomUUID } from "node:crypto";
import { Prisma, Operation } from "@prisma/client";
import { assertOpenAccountingPeriod, lockAccountingWrites } from "./accounting-period";
import { instantRange } from "./agency-time";
import "./monetary";

type Tx = Prisma.TransactionClient;
export type SaleItem = {
  clientId: string;
  amount: Prisma.Decimal.Value; // Monto TT, en la moneda de cabecera (currencyId)
  destCurrencyId: string; // Moneda del proveedor en esta línea (define el Debe)
  clientCurrencyId: string; // Moneda del cliente en esta línea (define el Haber); normalmente igual a destCurrencyId
  providerExchangeRate: Prisma.Decimal.Value; // Cotización del proveedor para esta línea
  exchangeRate: Prisma.Decimal.Value; // Cotización del cliente para esta línea
  observations: string | null;
  isPaid: boolean;
};
export type SaleInput = {
  providerId: string; currencyId: string; operationDate: Date; observations: string | null; items: SaleItem[];
  operationType?: "DISTRIBUTED_SALE" | "SINGLE_SALE";
};
export class SaleValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Serializa la numeración sin contar todas las operaciones hijas ni reutilizar números borrados.
export async function nextOperationNumber(tx: Tx) {
  await lockAccountingWrites(tx);
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

// Promedio ponderado de hoy (plata pagada / USDT recibidos) para una moneda de pago,
// sobre las compras de USDT registradas en el día (huso de la agencia). Null si no hubo ninguna.
export async function todayUsdtRate(tx: Tx, paidCurrencyId: string, usdtCurrencyId: string) {
  const range = instantRange("today");
  const [row] = await tx.$queryRaw<{ paid: Prisma.Decimal; usdt: Prisma.Decimal }[]>`
    SELECT COALESCE(SUM("originAmount"), 0) AS paid, COALESCE(SUM("destAmount"), 0) AS usdt
    FROM "Operation" WHERE type = 'USDT_PURCHASE' AND "deletedAt" IS NULL
      AND "originCurrencyId" = ${paidCurrencyId} AND "destCurrencyId" = ${usdtCurrencyId}
      AND "operationDate" >= ${range.gte} AND "operationDate" < ${range.lt}`;
  return row.usdt.isPositive() ? row.paid.dividedBy(row.usdt) : null;
}

// El cliente le manda el Monto TT directo al proveedor, y el proveedor le entrega el cambio
// directo al cliente: la plata nunca pasa por ninguna caja de la agencia, acá solo se llevan
// cuentas corrientes. Por línea: se le debe al proveedor (Monto TT / Cot. Proveedor, Debe, en
// destCurrencyId) y el cliente le queda debiendo a la agencia (Monto TT / Cotización Cliente,
// Haber, en clientCurrencyId — normalmente la misma moneda, pero puede diferir) hasta que se
// tilda "Pago", que cierra esa cuenta sin mover ninguna caja. `realProfitRate` guarda el
// promedio de compra de USDT del día, congelado al tildar "Pago" en una línea cuyo proveedor
// cobra en USDT, para ajustar la ganancia real contra lo que en verdad cuesta pagarle.
export async function applySaleLedger(tx: Tx, children: Operation[], input: SaleInput) {
  const pairKey = (contactId: string, currencyId: string) => `${contactId}:${currencyId}`;
  const pairs = new Map<string, { contactId: string; currencyId: string }>();
  children.forEach((child) => {
    pairs.set(pairKey(input.providerId, child.destCurrencyId), { contactId: input.providerId, currencyId: child.destCurrencyId });
    pairs.set(pairKey(child.clientId!, child.clientCurrencyId!), { contactId: child.clientId!, currencyId: child.clientCurrencyId! });
  });
  const pairList = Array.from(pairs.values()).sort((a, b) => pairKey(a.contactId, a.currencyId).localeCompare(pairKey(b.contactId, b.currencyId)));

  await tx.account.createMany({
    data: pairList.map(({ contactId, currencyId }) => ({ id: randomUUID(), contactId, currencyId, balance: 0 })),
    skipDuplicates: true,
  });
  // Bloquear y leer los saldos juntos evita sobrescribir cobros concurrentes.
  const contactIds = Array.from(new Set(pairList.map((p) => p.contactId))).sort();
  const currencyIds = Array.from(new Set(pairList.map((p) => p.currencyId))).sort();
  const accounts = await tx.$queryRaw<{ id: string; contactId: string; currencyId: string; balance: Prisma.Decimal }[]>`
    SELECT id, "contactId", "currencyId", balance FROM "Account"
    WHERE "currencyId" IN (${Prisma.join(currencyIds)}) AND "contactId" IN (${Prisma.join(contactIds)})
    ORDER BY id FOR UPDATE`;
  const accountMap = new Map(accounts.map((a) => [pairKey(a.contactId, a.currencyId), a]));
  const transactions: Prisma.TransactionCreateManyInput[] = [];
  const record = (contactId: string, currencyId: string, op: Operation, debit: Prisma.Decimal | 0, credit: Prisma.Decimal | 0, concept: string, observations: string) => {
    const account = accountMap.get(pairKey(contactId, currencyId))!;
    account.balance = account.balance.plus(credit).minus(debit);
    transactions.push({ id: randomUUID(), accountId: account.id, operationId: op.id, debit, credit,
      balance: account.balance, concept, observations, date: new Date() });
  };

  children.forEach((child, index) => {
    const item = input.items[index];
    record(input.providerId, child.destCurrencyId, child, 0, child.providerDebtAmount!,
      `Deuda por transferencia a cliente (Op: ${child.operationNumber})`,
      `Cotización Proveedor: ${child.providerExchangeRate}. Monto TT: $${child.originAmount.toString()}.`);
    record(child.clientId!, child.clientCurrencyId!, child, child.destAmount, 0,
      `Deuda por transferencia recibida del proveedor (Op: ${child.operationNumber})`,
      `Cotización Cliente: ${child.exchangeRate}. Monto TT: $${child.originAmount.toString()}. ${item.observations || ""}`);
    if (item.isPaid) record(child.clientId!, child.clientCurrencyId!, child, 0, child.destAmount,
      `Pago registrado al cliente (Op: ${child.operationNumber})`, `Cancelación de deuda por pago ya realizado - ${item.observations || ""}`);
  });

  await tx.$executeRaw`
    UPDATE "Account" a SET balance = v.balance FROM (VALUES
      ${Prisma.join(accounts.map((a) => Prisma.sql`(${a.id}::text, ${a.balance}::numeric)`))}
    ) AS v(id, balance) WHERE a.id = v.id`;
  await tx.transaction.createMany({ data: transactions });
}

export async function saveDistributedSale(tx: Tx, input: SaleInput, parentId?: string, canEditCompleted = true) {
  await lockAccountingWrites(tx);
  await assertOpenAccountingPeriod(tx, input.operationDate);
  if (input.operationType === "SINGLE_SALE" && input.items.length !== 1)
    throw new SaleValidationError("La operación 1 a 1 debe tener exactamente un movimiento de cliente.");
  input.items.forEach((item, index) => {
    if (new Prisma.Decimal(item.exchangeRate).gte(item.providerExchangeRate))
      throw new SaleValidationError(`La cotización del cliente tiene que ser menor a la del proveedor en la línea #${index + 1}.`);
  });
  let existing: (Operation & { childOperations: Operation[] }) | null = null;
  if (parentId) {
    // Leer después del bloqueo: dos ediciones concurrentes no revierten el mismo lote dos veces.
    await tx.$queryRaw`SELECT id FROM "Operation" WHERE id = ${parentId} FOR UPDATE`;
    existing = await tx.operation.findFirst({ where: { id: parentId, type: { in: ["DISTRIBUTED_SALE", "SINGLE_SALE"] }, parentOperationId: null, deletedAt: null },
      include: { childOperations: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } });
    if (!existing) throw new Error("Operación distribuida no encontrada");
    if (existing.state === "COMPLETED" && !canEditCompleted) {
      throw new SaleValidationError("Solo el administrador puede modificar una venta completada", 403);
    }
    await assertOpenAccountingPeriod(tx, existing.operationDate, ...existing.childOperations.map((child) => child.operationDate));
    if ((existing.type === "SINGLE_SALE" && input.items.length !== 1) || (input.operationType && input.operationType !== existing.type))
      throw new SaleValidationError("No se puede cambiar el tipo de operación. La operación 1 a 1 admite un solo movimiento de cliente.");
    existing.childOperations.sort((a, b) => a.operationNumber.localeCompare(b.operationNumber, undefined, { numeric: true }));
    await reverseSaleLedger(tx, [parentId, ...existing.childOperations.map(c => c.id)]);
  }
  const total = input.items.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
  const paid = input.items.filter(i => i.isPaid).length;
  const operationType = existing?.type || input.operationType || "DISTRIBUTED_SALE";

  // La cabecera no tiene una sola cotización/moneda de destino: cada línea puede diferir.
  // Se guardan valores representativos de la primera línea solo para no romper los campos
  // NOT NULL del modelo; no se usan para ningún cálculo (ver detalle por línea).
  const first = input.items[0];
  const data = {
    providerId: input.providerId, clientId: operationType === "SINGLE_SALE" ? input.items[0].clientId : null,
    originCurrencyId: input.currencyId, destCurrencyId: first.destCurrencyId,
    originAmount: total, destAmount: total.dividedBy(first.exchangeRate).toDecimalPlaces(8), exchangeRate: new Prisma.Decimal(first.exchangeRate),
    operationDate: input.operationDate, observations: input.observations,
    state: paid === input.items.length ? "COMPLETED" : paid ? "PARTIAL" : "PENDING",
    isPaid: paid === input.items.length, providerIsPaid: null,
    providerPaymentCurrencyId: null, providerPaymentRate: null, providerPaymentAmount: null };
  const parent = existing
    ? await tx.operation.update({ where: { id: existing.id }, data })
    : await tx.operation.create({ data: { ...data, id: randomUUID(), operationNumber: await nextOperationNumber(tx), type: operationType } });
  const now = new Date();
  const usdtCurrency = await tx.currency.findUnique({ where: { code: "USDT" }, select: { id: true } });
  const usdtCurrencyId = usdtCurrency?.id ?? null;
  const children: Operation[] = [];
  for (let index = 0; index < input.items.length; index++) {
    const item = input.items[index];
    const previous = existing?.childOperations[index];
    // El promedio de compra de USDT se congela la primera vez que la línea queda pagada;
    // si ya estaba pagada, se conserva el valor de entonces (no se recalcula en cada edición).
    let realProfitRate: Prisma.Decimal | null = null;
    if (item.destCurrencyId === usdtCurrencyId && item.isPaid) {
      realProfitRate = previous?.isPaid ? previous.realProfitRate : await todayUsdtRate(tx, input.currencyId, usdtCurrencyId!);
    }
    children.push({ ...parent,
      id: previous?.id || randomUUID(),
      operationNumber: previous?.operationNumber || `${parent.operationNumber}-${index + 1}`,
      type: "DISTRIBUTED_SALE_ITEM", parentOperationId: parent.id, clientId: item.clientId, providerIsPaid: null,
      originCurrencyId: input.currencyId, destCurrencyId: item.destCurrencyId, clientCurrencyId: item.clientCurrencyId,
      originAmount: new Prisma.Decimal(item.amount),
      destAmount: new Prisma.Decimal(item.amount).dividedBy(item.exchangeRate).toDecimalPlaces(8),
      exchangeRate: new Prisma.Decimal(item.exchangeRate),
      providerExchangeRate: new Prisma.Decimal(item.providerExchangeRate),
      providerDebtAmount: new Prisma.Decimal(item.amount).dividedBy(item.providerExchangeRate).toDecimalPlaces(8),
      realProfitRate,
      observations: item.observations, state: item.isPaid ? "COMPLETED" : "PENDING", isPaid: item.isPaid,
      deletedAt: null, createdAt: previous?.createdAt || now, updatedAt: now });
  }
  if (existing) {
    const excess = existing.childOperations.slice(children.length);
    if (excess.length) await tx.$executeRaw`
      UPDATE "Operation" SET "deletedAt" = ${now}, "updatedAt" = ${now},
        "operationNumber" = "operationNumber" || '-DEL-' || id WHERE id IN (${Prisma.join(excess.map(c => c.id))})`;
    // Una sentencia para todas las hijas existentes y nuevas; conservar IDs y adjuntos.
    await tx.$executeRaw`
      INSERT INTO "Operation" (id, "operationNumber", type, "parentOperationId", "clientId", "providerId",
        "originCurrencyId", "destCurrencyId", "clientCurrencyId", "originAmount", "destAmount", "exchangeRate",
        "providerExchangeRate", "providerDebtAmount", "realProfitRate", "operationDate",
        "isPaid", observations, state, "createdAt", "updatedAt", "deletedAt")
      SELECT id, "operationNumber", type, "parentOperationId", "clientId", "providerId", "originCurrencyId", "destCurrencyId",
        "clientCurrencyId", "originAmount", "destAmount", "exchangeRate", "providerExchangeRate", "providerDebtAmount", "realProfitRate",
        "operationDate", "isPaid", observations, state, "createdAt", "updatedAt", "deletedAt"
      FROM jsonb_populate_recordset(NULL::"Operation", ${JSON.stringify(children)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET "clientId" = EXCLUDED."clientId", "providerId" = EXCLUDED."providerId",
        "originCurrencyId" = EXCLUDED."originCurrencyId", "destCurrencyId" = EXCLUDED."destCurrencyId",
        "clientCurrencyId" = EXCLUDED."clientCurrencyId",
        "originAmount" = EXCLUDED."originAmount", "destAmount" = EXCLUDED."destAmount", "exchangeRate" = EXCLUDED."exchangeRate",
        "providerExchangeRate" = EXCLUDED."providerExchangeRate", "providerDebtAmount" = EXCLUDED."providerDebtAmount",
        "realProfitRate" = EXCLUDED."realProfitRate",
        "operationDate" = EXCLUDED."operationDate", "isPaid" = EXCLUDED."isPaid", observations = EXCLUDED.observations,
        state = EXCLUDED.state, "updatedAt" = EXCLUDED."updatedAt"`;
  } else {
    await tx.operation.createMany({ data: children });
  }
  await applySaleLedger(tx, children, input);
  return { parentOp: parent, childOperations: children };
}
