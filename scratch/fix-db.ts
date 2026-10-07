import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBalances() {
  console.log("Iniciando reparación de saldos y transacciones...");

  // 1. Encontrar todas las operaciones distribuidas
  const distOps = await prisma.operation.findMany({
    where: {
      type: { in: ['DISTRIBUTED_SALE', 'DISTRIBUTED_SALE_ITEM'] }
    }
  });

  const distOpIds = distOps.map(op => op.id);
  const distOpNumbers = distOps.map(op => op.operationNumber);

  console.log(`Encontradas ${distOps.length} operaciones distribuidas.`);

  // 2. Encontrar todas las transacciones asociadas a esas operaciones
  // También buscar las reversiones (que tienen operationId=null pero el concepto contiene el número)
  const txs = await prisma.transaction.findMany();

  /*
  let swapCount = 0;

  for (const tx of txs) {
    let shouldSwap = false;

    // Si es una transacción directa de la operación
    if (tx.operationId && distOpIds.includes(tx.operationId)) {
      shouldSwap = true;
    }
    // Si es una reversión de una operación distribuida
    else if (!tx.operationId && tx.concept.startsWith('Reversión')) {
      for (const opNum of distOpNumbers) {
        if (tx.concept.includes(opNum)) {
          shouldSwap = true;
          break;
        }
      }
    }

    if (shouldSwap) {
      // Intercambiar credit y debit porque estaban al revés
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          credit: tx.debit,
          debit: tx.credit
        }
      });
      swapCount++;
    }
  }

  console.log(`Se invirtieron credit/debit en ${swapCount} transacciones de Venta Distribuida.`);
  */

  // 3. Recalcular todos los balances de Accounts basándonos en la convención única:
  // CREDIT = (+) aumenta el balance
  // DEBIT = (-) disminuye el balance
  
  const accounts = await prisma.account.findMany();
  
  for (const acc of accounts) {
    const accountTxs = await prisma.transaction.findMany({
      where: { accountId: acc.id },
      orderBy: { date: 'asc' }
    });

    let runningBalance = 0;
    
    for (const tx of accountTxs) {
      runningBalance += tx.credit;
      runningBalance -= tx.debit;
      
      // Actualizar el balance histórico en la transacción para que quede prolijo
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { balance: runningBalance }
      });
    }

    // Actualizar el balance final de la cuenta
    await prisma.account.update({
      where: { id: acc.id },
      data: { balance: runningBalance }
    });
  }

  console.log(`Se recalcularon los balances de ${accounts.length} cuentas corrientes.`);

  console.log("¡Reparación completada!");
}

fixBalances()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
