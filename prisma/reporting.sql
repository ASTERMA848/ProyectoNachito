-- Ejecutar con el propietario de las tablas en la base de Calce.
-- Crear la contraseña del rol con \password calce_report_reader en psql.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'calce_report_reader') THEN
    CREATE ROLE calce_report_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS calce_reporting;
REVOKE ALL ON SCHEMA calce_reporting FROM PUBLIC;
GRANT USAGE ON SCHEMA calce_reporting TO calce_report_reader;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM calce_report_reader;

CREATE OR REPLACE VIEW calce_reporting."Operation" AS
  SELECT id, "operationNumber", type, "parentOperationId", "clientId", "providerId",
    "originCurrencyId", "destCurrencyId", "originAmount", "destAmount", "exchangeRate",
    "operationDate", "isPaid", "providerIsPaid", state
  FROM public."Operation" WHERE "deletedAt" IS NULL;
CREATE OR REPLACE VIEW calce_reporting."Currency" AS
  SELECT id, code, name, symbol, decimals, "isActive" FROM public."Currency";
CREATE OR REPLACE VIEW calce_reporting."Account" AS
  SELECT id, "contactId", "currencyId", balance FROM public."Account";
CREATE OR REPLACE VIEW calce_reporting."TreasuryAccount" AS
  SELECT id, name, type, "currencyId", balance, "isActive" FROM public."TreasuryAccount";
CREATE OR REPLACE VIEW calce_reporting."TreasuryMovement" AS
  SELECT id, "treasuryAccountId", "operationId", date, type, amount FROM public."TreasuryMovement";

GRANT SELECT ON calce_reporting."Operation", calce_reporting."Currency", calce_reporting."Account",
  calce_reporting."TreasuryAccount", calce_reporting."TreasuryMovement" TO calce_report_reader;

COMMIT;
