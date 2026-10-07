import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTreasury() {
  // 1. Eliminar movimientos de operaciones eliminadas o reversiones desvinculadas
  const del = await prisma.treasuryMovement.deleteMany({
    where: {
      OR: [
        { operation: { deletedAt: { not: null } } },
        { operationId: null },
      ],
    },
  });
  console.log(`Eliminados ${del.count} movimientos de tesorería antiguos/duplicados.`);

  // 2. Recalcular saldos de cada caja basándose en los movimientos activos reales
  const accounts = await prisma.treasuryAccount.findMany();
  for (const acc of accounts) {
    const movs = await prisma.treasuryMovement.findMany({
      where: { treasuryAccountId: acc.id },
    });

    let sum = 0;
    for (const m of movs) {
      sum += m.type === 'INCOME' ? m.amount : -m.amount;
    }

    await prisma.treasuryAccount.update({
      where: { id: acc.id },
      data: { balance: sum },
    });

    console.log(`Nuevo saldo para ${acc.name}: ${sum}`);
  }
}

cleanTreasury()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

