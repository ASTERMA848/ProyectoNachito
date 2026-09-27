const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const currencies = [
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'ARS', name: 'Peso Argentino', symbol: '$' },
    { code: 'BRL', name: 'Real Brasileño', symbol: 'R$' },
    { code: 'USDT', name: 'Tether (Crypto)', symbol: '₮' },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log('Monedas insertadas correctamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
