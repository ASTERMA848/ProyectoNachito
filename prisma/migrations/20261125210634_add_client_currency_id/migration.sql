-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "clientCurrencyId" TEXT;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_clientCurrencyId_fkey" FOREIGN KEY ("clientCurrencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
