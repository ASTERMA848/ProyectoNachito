CREATE TABLE "LoginAttempt" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "LoginAttempt_expiresAt_idx" ON "LoginAttempt"("expiresAt");
