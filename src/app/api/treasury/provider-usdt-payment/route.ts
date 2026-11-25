import { monetaryJson, positiveDecimal } from "@/lib/monetary";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { TreasuryError } from "@/lib/manual-treasury";
import { nextOperationNumber } from "@/lib/distributed-sale";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { AccountingPeriodError, assertOpenAccountingPeriod, lockAccountingWrites } from "@/lib/accounting-period";
import { dateOnlyRange } from "@/lib/agency-time";

export const dynamic = "force-dynamic";

// Pago a un proveedor con USDT comprado en la grilla diaria: cancela (parte de) su Debe en la
// cuenta corriente y saca ese importe de la caja de USDT. Se modela igual que una compra de USDT,
// pero además toca la Account del proveedor.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!can(user, "treasury.write"))
      return NextResponse.json({ error: "No tenés permiso para pagarle a un proveedor." }, { status: 403 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Los datos de la solicitud no son válidos." }, { status: 400 });
    }

    const input = body as Record<string, unknown> | null;
    if (!input || typeof input !== "object") {
      throw new TreasuryError("Datos no válidos.");
    }

    const providerId = typeof input.providerId === "string" ? input.providerId.trim() : "";
    const debtCurrencyId = typeof input.debtCurrencyId === "string" ? input.debtCurrencyId.trim() : "";
    const debtAmount = positiveDecimal(input.debtAmount);
    const usdtAmount = positiveDecimal(input.usdtAmount);
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";

    if (!providerId) throw new TreasuryError("Seleccioná el proveedor.");
    if (!debtCurrencyId) throw new TreasuryError("Seleccioná en qué moneda se cancela el Debe.");
    if (!debtAmount) throw new TreasuryError("El importe a saldar debe ser mayor a cero.");
    if (!usdtAmount) throw new TreasuryError("La cantidad de USDT a entregar debe ser mayor a cero.");

    const result = await prisma.$transaction(async (tx) => {
      await lockAccountingWrites(tx);
      const now = new Date();
      await assertOpenAccountingPeriod(tx, dateOnlyRange("today", now).gte);

      const [provider, debtCurrency, usdtAccountRow] = await Promise.all([
        tx.contact.findFirst({ where: { id: providerId, deletedAt: null, isProvider: true } }),
        tx.currency.findFirst({ where: { id: debtCurrencyId, isActive: true } }),
        tx.treasuryAccount.findFirst({
          where: { isActive: true, currency: { code: "USDT", isActive: true } },
          include: { currency: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
      ]);
      if (!provider) throw new TreasuryError("Proveedor no encontrado.");
      if (!debtCurrency) throw new TreasuryError("La moneda del Debe no existe o está inactiva.");
      if (!usdtAccountRow) throw new TreasuryError("No hay una caja de USDT activa.");

      if (debtAmount.decimalPlaces() > debtCurrency.decimals || usdtAmount.decimalPlaces() > usdtAccountRow.currency.decimals) {
        throw new TreasuryError("Cada importe debe respetar los decimales de su moneda.");
      }

      const account = await tx.account.findUnique({ where: { contactId_currencyId: { contactId: providerId, currencyId: debtCurrencyId } } });
      if (!account || account.balance.lt(debtAmount)) {
        throw new TreasuryError("La deuda de este proveedor en esta moneda es menor a lo que querés pagar.");
      }

      const updatedUsdtCount = await tx.treasuryAccount.updateMany({
        where: { id: usdtAccountRow.id, isActive: true, balance: { gte: usdtAmount } },
        data: { balance: { decrement: usdtAmount } },
      });
      if (updatedUsdtCount.count !== 1) {
        throw new TreasuryError("La caja de USDT no tiene saldo suficiente para este pago.", 409);
      }

      const opNumber = await nextOperationNumber(tx);
      const rate = debtAmount.dividedBy(usdtAmount).toDecimalPlaces(8);
      const concept = `Pago a proveedor en USDT (${provider.name} ${provider.lastname ?? ""})`.trim();

      const operation = await tx.operation.create({
        data: {
          operationNumber: opNumber,
          type: "PROVIDER_USDT_PAYMENT",
          providerId,
          originCurrencyId: usdtAccountRow.currencyId,
          destCurrencyId: debtCurrencyId,
          originAmount: usdtAmount,
          destAmount: debtAmount,
          exchangeRate: rate,
          operationDate: now,
          isPaid: true,
          providerIsPaid: true,
          state: "COMPLETED",
          observations: reason || concept,
        },
      });

      const updatedAccount = await tx.account.update({ where: { id: account.id }, data: { balance: { decrement: debtAmount } } });
      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id, operationId: operation.id, debit: debtAmount, credit: 0,
          balance: updatedAccount.balance, concept: `Pago a proveedor en USDT (Op: ${opNumber})`,
          observations: reason || undefined, date: now,
        },
      });

      const [treasuryMovement, updatedUsdtAccount] = await Promise.all([
        tx.treasuryMovement.create({
          data: {
            treasuryAccountId: usdtAccountRow.id, operationId: operation.id, type: "EXPENSE", amount: usdtAmount,
            concept: `Pago a proveedor (${provider.name} ${provider.lastname ?? ""})`.trim(), observations: reason || undefined,
          },
          include: { account: { include: { currency: true } }, operation: { select: { operationNumber: true } } },
        }),
        tx.treasuryAccount.findUniqueOrThrow({ where: { id: usdtAccountRow.id }, include: { currency: true } }),
      ]);

      await logAudit({
        userId: user.id,
        action: "CREATE",
        entity: "ProviderUsdtPayment",
        entityId: operation.id,
        newValues: JSON.stringify(monetaryJson({ providerId, debtCurrencyId, debtAmount, usdtAmount, rate, reason,
          accountBalanceAfter: updatedAccount.balance, usdtBalanceAfter: updatedUsdtAccount.balance })),
      }, tx);

      return { operation, account: updatedAccount, transaction, treasuryMovement, usdtAccount: updatedUsdtAccount };
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json(monetaryJson(result), { status: 201 });
  } catch (error) {
    if (error instanceof AccountingPeriodError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof TreasuryError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Provider USDT payment error:", error);
    return NextResponse.json({ error: "No se pudo registrar el pago al proveedor." }, { status: 500 });
  }
}
