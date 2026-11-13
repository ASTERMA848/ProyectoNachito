-- Diagnóstico de solo lectura. Un saldo inicial sin movimiento aparece como diferencia.
WITH account_totals AS (
  SELECT "accountId", sum(credit - debit) AS balance
  FROM "Transaction" GROUP BY "accountId"
), treasury_totals AS (
  SELECT "treasuryAccountId", sum(CASE WHEN type = 'EXPENSE' THEN -amount ELSE amount END) AS balance
  FROM "TreasuryMovement" GROUP BY "treasuryAccountId"
), balances AS (
  SELECT 'Cuenta corriente' AS origen, account.id, currency.code AS moneda,
    account.balance::numeric AS saldo, coalesce(total.balance, 0)::numeric AS movimientos
  FROM "Account" account JOIN "Currency" currency ON currency.id = account."currencyId"
  LEFT JOIN account_totals total ON total."accountId" = account.id
  UNION ALL
  SELECT 'Tesorería', account.id, currency.code, account.balance::numeric, coalesce(total.balance, 0)::numeric
  FROM "TreasuryAccount" account JOIN "Currency" currency ON currency.id = account."currencyId"
  LEFT JOIN treasury_totals total ON total."treasuryAccountId" = account.id
)
SELECT origen, id, moneda, saldo, movimientos, round(saldo - movimientos, 8) AS diferencia
FROM balances WHERE round(saldo - movimientos, 8) <> 0
ORDER BY origen, moneda, id;
