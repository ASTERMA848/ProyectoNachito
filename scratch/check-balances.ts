import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBalances() {
  const accounts = await prisma.account.findMany({
    where: { balance: { not: { equals: 0 } } },
    include: {
      contact: true,
      currency: true,
      transactions: {
        orderBy: { date: 'asc' }
      }
    }
  });

  for (const acc of accounts) {
    if (!acc.balance.isZero()) {
      console.log(`\n==============================================`);
      console.log(`Cuenta: ${acc.contact.name} - ${acc.currency.code}`);
      console.log(`Balance Actual: ${acc.balance}`);
      console.log(`Transacciones:`);
      for (const tx of acc.transactions) {
        console.log(`  [${tx.date.toISOString().split('T')[0]}] ${tx.concept.substring(0, 50).padEnd(50)} | Credit: ${tx.credit} | Debit: ${tx.debit} | Bal: ${tx.balance} | OpId: ${tx.operationId}`);
      }
    }
  }

  if (accounts.length === 0) {
    console.log("No hay cuentas con balance distinto de cero.");
  }
}

checkBalances()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

