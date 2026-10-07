import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteDuplicateReversals() {
  const txs = await prisma.transaction.findMany({
    where: {
      concept: { startsWith: 'Reversión' }
    }
  });

  let deletedCount = 0;

  for (const tx of txs) {
    // Extract the operation number from the concept, e.g., "Reversión por edición Op. OP-000014" -> "OP-000014"
    const match = tx.concept.match(/Op\. (OP-\d+(-\d+)?)/);
    if (!match) continue;

    const opNum = match[1];

    // If it's a parent operation number (no dash)
    if (!opNum.includes('-')) {
      // Find the original operation
      const parentOp = await prisma.operation.findUnique({
        where: { operationNumber: opNum }
      });

      if (parentOp) {
        // Find if this account actually had a direct transaction from the parent operation BEFORE the reversal
        const originalTxs = await prisma.transaction.findMany({
          where: {
            accountId: tx.accountId,
            operationId: parentOp.id
          }
        });

        // If the account NEVER had a transaction linked directly to the parent operation,
        // then this reversal was erroneously created because of the 'contains' bug!
        if (originalTxs.length === 0) {
          console.log(`Deleting duplicate reversal: ${tx.concept} for account ${tx.accountId}`);
          await prisma.transaction.delete({ where: { id: tx.id } });
          deletedCount++;
        }
      }
    }
  }

  console.log(`Deleted ${deletedCount} duplicate reversals.`);

  // Recalculate balances
  const accounts = await prisma.account.findMany();
  for (const acc of accounts) {
    const accountTxs = await prisma.transaction.findMany({
      where: { accountId: acc.id },
      orderBy: { date: 'asc' }
    });

    let runningBalance = 0;
    for (const atx of accountTxs) {
      runningBalance += atx.credit;
      runningBalance -= atx.debit;
      await prisma.transaction.update({
        where: { id: atx.id },
        data: { balance: runningBalance }
      });
    }

    await prisma.account.update({
      where: { id: acc.id },
      data: { balance: runningBalance }
    });
  }

  console.log("Balances recalculated.");
}

deleteDuplicateReversals()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

