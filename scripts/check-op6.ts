import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const ops = await prisma.operation.findMany({
    where: { operationNumber: { startsWith: "OP-000006" } },
    include: { childOperations: true, treasuryMovements: { include: { account: true } } }
  });
  console.log("=== OPERATIONS OP-000006 ===");
  console.log(JSON.stringify(ops, null, 2));

  const tAccounts = await prisma.treasuryAccount.findMany({
    include: { movements: { include: { operation: true } } }
  });
  console.log("=== TREASURY ACCOUNTS ===");
  console.log(JSON.stringify(tAccounts, null, 2));
  process.exit(0);
}

check().catch(console.error);

