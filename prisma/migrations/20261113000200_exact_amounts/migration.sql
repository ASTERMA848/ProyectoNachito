BEGIN;

-- PostgreSQL admite NaN en numeric. Una fila no finita requiere revisión antes de convertir.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Operation" WHERE "originAmount"::text IN ('NaN', 'Infinity', '-Infinity')
      OR "destAmount"::text IN ('NaN', 'Infinity', '-Infinity')
      OR "exchangeRate"::text IN ('NaN', 'Infinity', '-Infinity')
      OR "providerPaymentRate"::text IN ('NaN', 'Infinity', '-Infinity')
      OR "providerPaymentAmount"::text IN ('NaN', 'Infinity', '-Infinity')
    UNION ALL
    SELECT 1 FROM "Account" WHERE balance::text IN ('NaN', 'Infinity', '-Infinity')
    UNION ALL
    SELECT 1 FROM "Transaction" WHERE debit::text IN ('NaN', 'Infinity', '-Infinity')
      OR credit::text IN ('NaN', 'Infinity', '-Infinity') OR balance::text IN ('NaN', 'Infinity', '-Infinity')
    UNION ALL
    SELECT 1 FROM "TreasuryAccount" WHERE balance::text IN ('NaN', 'Infinity', '-Infinity')
    UNION ALL
    SELECT 1 FROM "TreasuryMovement" WHERE amount::text IN ('NaN', 'Infinity', '-Infinity')
    UNION ALL
    SELECT 1 FROM "Settlement" WHERE amount::text IN ('NaN', 'Infinity', '-Infinity')
      OR "paidAmount"::text IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'Hay importes o saldos no finitos. Revisá esos registros antes de migrar.';
  END IF;
END $$;

ALTER TABLE "Operation"
  ALTER COLUMN "originAmount" TYPE numeric(30, 8) USING round("originAmount"::numeric, 8),
  ALTER COLUMN "destAmount" TYPE numeric(30, 8) USING round("destAmount"::numeric, 8),
  ALTER COLUMN "exchangeRate" TYPE numeric(30, 8) USING round("exchangeRate"::numeric, 8),
  ALTER COLUMN "providerPaymentRate" TYPE numeric(30, 8) USING round("providerPaymentRate"::numeric, 8),
  ALTER COLUMN "providerPaymentAmount" TYPE numeric(30, 8) USING round("providerPaymentAmount"::numeric, 8);
ALTER TABLE "Account"
  ALTER COLUMN "balance" TYPE numeric(30, 8) USING round("balance"::numeric, 8);
ALTER TABLE "Transaction"
  ALTER COLUMN "debit" TYPE numeric(30, 8) USING round("debit"::numeric, 8),
  ALTER COLUMN "credit" TYPE numeric(30, 8) USING round("credit"::numeric, 8),
  ALTER COLUMN "balance" TYPE numeric(30, 8) USING round("balance"::numeric, 8);
ALTER TABLE "TreasuryAccount"
  ALTER COLUMN "balance" TYPE numeric(30, 8) USING round("balance"::numeric, 8);
ALTER TABLE "TreasuryMovement"
  ALTER COLUMN "amount" TYPE numeric(30, 8) USING round("amount"::numeric, 8);
ALTER TABLE "Settlement"
  ALTER COLUMN "amount" TYPE numeric(30, 8) USING round("amount"::numeric, 8),
  ALTER COLUMN "paidAmount" TYPE numeric(30, 8) USING round("paidAmount"::numeric, 8);

COMMIT;
