-- replica/schema.sql
-- Tablas, columnas e índices nuevos para la interfaz al estilo de Odoo (ver replica/architecture.md).
--
-- Convenciones de este proyecto, que se respetan para no romper las claves foráneas:
--   * nombres de Prisma entre comillas ("SavedFilter", "userId")
--   * ids text con un UUID adentro, porque "User".id y el resto de las claves existentes son text
--   * fechas nuevas en timestamptz (UTC). Las columnas existentes siguen en timestamp sin zona,
--     y Prisma ya escribe UTC en ellas
--
-- Se aplica como migración de Prisma. Prisma no expresa los CHECK ni los índices parciales en
-- schema.prisma: se copian a mano en el SQL de la migración. En schema.prisma los ids nuevos van
-- con @default(dbgenerated("gen_random_uuid()::text")) y las fechas con @db.Timestamptz(3).

-- 1. Favoritos de búsqueda (F03, should)
CREATE TABLE "SavedFilter" (
  "id"        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "screen"    text NOT NULL CHECK ("screen" IN ('operations', 'contacts', 'accounts', 'treasury', 'audit', 'users', 'currencies')),
  "name"      text NOT NULL CHECK (char_length("name") BETWEEN 1 AND 80),
  "filters"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  "groupBy"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  "columns"   jsonb,
  "isDefault" boolean NOT NULL DEFAULT false,
  "isShared"  boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT now()
);
-- Empieza por "userId", así que también sirve de índice de la clave foránea
CREATE UNIQUE INDEX "SavedFilter_userId_screen_name_key" ON "SavedFilter" ("userId", "screen", "name");
-- Un solo favorito predeterminado por usuario y pantalla
CREATE UNIQUE INDEX "SavedFilter_one_default_key" ON "SavedFilter" ("userId", "screen") WHERE "isDefault";
CREATE INDEX "SavedFilter_screen_shared_idx" ON "SavedFilter" ("screen") WHERE "isShared";

-- 2. Notas internas de cualquier registro (F06, should). No se editan ni se borran, solo se fijan
CREATE TABLE "RecordNote" (
  "id"        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entity"    text NOT NULL CHECK ("entity" IN ('Operation', 'Contact', 'Account', 'TreasuryAccount', 'Currency', 'User')),
  "entityId"  text NOT NULL,
  "authorId"  text NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "body"      text NOT NULL CHECK (char_length("body") BETWEEN 1 AND 5000),
  "isPinned"  boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX "RecordNote_entity_entityId_createdAt_idx" ON "RecordNote" ("entity", "entityId", "createdAt" DESC);
CREATE INDEX "RecordNote_authorId_idx" ON "RecordNote" ("authorId");

-- 3. Adjuntos de cualquier registro (F06, should). Reemplaza a "Attachment", que solo admitía
--    operaciones y no tiene filas ni uso en el código. El archivo vive fuera de public/
DROP TABLE "Attachment";
CREATE TABLE "Attachment" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entity"       text NOT NULL CHECK ("entity" IN ('Operation', 'Contact', 'Account', 'TreasuryAccount')),
  "entityId"     text NOT NULL,
  "uploadedById" text REFERENCES "User"("id") ON DELETE SET NULL,
  "fileName"     text NOT NULL CHECK (char_length("fileName") BETWEEN 1 AND 255),
  "storageKey"   text NOT NULL UNIQUE,
  "mimeType"     text NOT NULL CHECK ("mimeType" IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  "sizeBytes"    integer NOT NULL CHECK ("sizeBytes" BETWEEN 1 AND 52428800),
  "sha256"       text NOT NULL CHECK (char_length("sha256") = 64),
  "createdAt"    timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX "Attachment_entity_entityId_createdAt_idx" ON "Attachment" ("entity", "entityId", "createdAt" DESC);
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment" ("uploadedById");

-- 4. Actividades programadas (S19, could). El estado sale de "doneAt" y "dueDate":
--    hecha, vencida, hoy o planificada, calculado en la zona horaria de Ajustes
CREATE TABLE "Activity" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entity"       text NOT NULL CHECK ("entity" IN ('Operation', 'Contact', 'Account', 'TreasuryAccount')),
  "entityId"     text NOT NULL,
  "activityType" text NOT NULL DEFAULT 'TODO' CHECK ("activityType" IN ('TODO', 'CALL', 'EMAIL', 'MEETING', 'DOCUMENT')),
  "summary"      text NOT NULL CHECK (char_length("summary") BETWEEN 1 AND 200),
  "note"         text CHECK (char_length("note") <= 2000),
  "dueDate"      date NOT NULL,
  "assignedToId" text NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdById"  text NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "doneAt"       timestamptz(3),
  "doneById"     text REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt"    timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "Activity_done_check" CHECK (("doneAt" IS NULL) = ("doneById" IS NULL))
);
CREATE INDEX "Activity_assignedToId_dueDate_open_idx" ON "Activity" ("assignedToId", "dueDate") WHERE "doneAt" IS NULL;
CREATE INDEX "Activity_entity_entityId_idx" ON "Activity" ("entity", "entityId");
CREATE INDEX "Activity_createdById_idx" ON "Activity" ("createdById");
CREATE INDEX "Activity_doneById_idx" ON "Activity" ("doneById");

-- 5. Ajustes nuevos: bloqueo de borrado de registros auditados y zona horaria de la agencia,
--    usada para "este mes", agrupar por día o mes y vencimientos
ALTER TABLE "Settings"
  ADD COLUMN "restrictiveAuditTrail" boolean NOT NULL DEFAULT false,
  ADD COLUMN "timeZone" text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

-- 6. Índices para buscar, filtrar y agrupar en tablas existentes
--    (claves foráneas sin índice y columnas de filtro u orden)
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog" ("entity", "entityId", "createdAt" DESC);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt" DESC);
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog" ("userId", "createdAt" DESC);
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt" DESC);
CREATE INDEX "Operation_clientId_idx" ON "Operation" ("clientId");
CREATE INDEX "Operation_providerId_idx" ON "Operation" ("providerId");
CREATE INDEX "Operation_originCurrencyId_idx" ON "Operation" ("originCurrencyId");
CREATE INDEX "Operation_destCurrencyId_idx" ON "Operation" ("destCurrencyId");
CREATE INDEX "Operation_providerPaymentCurrencyId_idx" ON "Operation" ("providerPaymentCurrencyId");
CREATE INDEX "OperationStateHistory_operationId_changedAt_idx" ON "OperationStateHistory" ("operationId", "changedAt" DESC);
CREATE INDEX "Contact_deletedAt_name_idx" ON "Contact" ("deletedAt", "name");
CREATE INDEX "ContactTag_tagId_idx" ON "ContactTag" ("tagId");
CREATE INDEX "Account_currencyId_idx" ON "Account" ("currencyId");
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");

-- 7. Limpieza, después de pasar el código a "RecordNote". "InternalComment" no tiene filas ni uso,
--    salvo un deleteMany en DELETE /api/operations/[id]. Confirmar 0 filas antes de correrlo
DROP TABLE "InternalComment";
