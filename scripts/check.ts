import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const ops = await prisma.operation.findMany({
        where: { deletedAt: null, parentOperationId: null },
        include: {
          client: { select: { id: true, name: true, document: true } },
          provider: { select: { id: true, name: true, document: true } },
          originCurrency: { select: { id: true, code: true, symbol: true, color: true } },
          destCurrency: { select: { id: true, code: true, symbol: true, color: true } },
          parentOperation: { select: { id: true, operationNumber: true } },
          childOperations: {
            select: {
              id: true,
              operationNumber: true,
              state: true,
              originAmount: true,
              destAmount: true,
              isPaid: true,
              clientId: true,
              exchangeRate: true,
              observations: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        take: 1,
      });
  console.log(Object.keys(ops[0]));
  console.log("clientId:", ops[0].clientId);
  console.log("exchangeRate:", ops[0].exchangeRate);
  process.exit(0);
}
check();

