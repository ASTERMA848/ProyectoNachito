import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const tAccounts = await prisma.treasuryAccount.findMany({
    include: { currency: true, movements: { include: { operation: true }, orderBy: { date: 'asc' } } }
  });

  for (const acc of tAccounts) {
    console.log(`\n=== CAJA: ${acc.name} (${acc.currency.code}) ===`);
    console.log(`Saldo Actual DB: ${acc.balance}`);
    let calcBalance = 0;
    for (const mov of acc.movements) {
      calcBalance += mov.type === 'INCOME' ? mov.amount : -mov.amount;
      console.log(`  [${mov.date.toISOString()}] ${mov.type} ${mov.amount} | Concepto: "${mov.concept}" | Op: ${mov.operation?.operationNumber || 'N/A'}`);
    }
    console.log(`Saldo Calculado Histórico: ${calcBalance}`);
  }

  process.exit(0);
}

check().catch(console.error);

