import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function fixBalances() {
  console.log("Fixing Account balances...");
  const accounts = await prisma.account.findMany({ include: { transactions: { orderBy: { date: 'asc' } } } });
  
  for (const acc of accounts) {
    let balance = new Prisma.Decimal(0);
    for (const tx of (acc.transactions as any[])) {
      balance = balance.minus(tx.debit).plus(tx.credit);
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { balance }
      });
    }
    
    if (!acc.balance.equals(balance)) {
      console.log(`Fixing account ${acc.id} (${acc.contactId}) from ${acc.balance} to ${balance}`);
      await prisma.account.update({
        where: { id: acc.id },
        data: { balance }
      });
    }
  }

  console.log("Fixing Treasury Account balances...");
  const tAccounts = await prisma.treasuryAccount.findMany({ include: { movements: { orderBy: { date: 'asc' } } } });
  
  for (const tAcc of tAccounts) {
    let tBalance = new Prisma.Decimal(0);
    for (const mov of (tAcc.movements as any[])) {
      tBalance = mov.type === 'INCOME' ? tBalance.plus(mov.amount) : tBalance.minus(mov.amount);
    }
    
    if (!tAcc.balance.equals(tBalance)) {
      console.log(`Fixing treasury account ${tAcc.id} from ${tAcc.balance} to ${tBalance}`);
      await prisma.treasuryAccount.update({
        where: { id: tAcc.id },
        data: { balance: tBalance }
      });
    }
  }

  console.log("Done.");
  process.exit(0);
}

fixBalances().catch(console.error);
