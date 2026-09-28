const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Inicializando base de datos local...");

  // 1. Crear Monedas por defecto
  const currencies = [
    { code: "USD", name: "Dólar Estadounidense", symbol: "$", color: "#3b82f6" },
    { code: "EUR", name: "Euro", symbol: "€", color: "#60a5fa" },
    { code: "ARS", name: "Peso Argentino", symbol: "$", color: "#34d399" },
    { code: "BRL", name: "Real Brasileño", symbol: "R$", color: "#fbbf24" },
    { code: "USDT", name: "Tether (Crypto)", symbol: "₮", color: "#c084fc" },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log("✓ Monedas base insertadas/verificadas.");

  // 2. Crear Configuración por defecto
  const existingSettings = await prisma.settings.findFirst();
  if (!existingSettings) {
    const usdCurrency = await prisma.currency.findUnique({ where: { code: "USD" } });
    await prisma.settings.create({
      data: {
        mainCurrencyId: usdCurrency?.id || null,
      },
    });
    console.log("✓ Ajustes del sistema inicializados.");
  }

  // 3. Crear Usuario Admin por defecto si no existe ninguno
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const defaultPassword = "admin";
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash,
        role: "ADMIN",
        theme: "SYSTEM",
        isActive: true,
      },
    });
    console.log("✓ Usuario de administración creado por defecto (Usuario: admin / Clave: admin).");
  }

  console.log("✅ Inicialización completada con éxito.");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seeding de la base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
