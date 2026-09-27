import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Borrando datos...');
  
  // Delete in order to avoid foreign key constraints
  await prisma.auditLog.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.treasuryMovement.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.internalComment.deleteMany();
  await prisma.operationStateHistory.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.account.deleteMany();
  await prisma.treasuryAccount.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tag.deleteMany();
  
  // Also delete currencies, settings, sessions, users
  await prisma.currency.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('Base de datos reiniciada. Se han eliminado todos los registros.');
  console.log('El usuario admin/admin se creará automáticamente en el próximo inicio de sesión.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
