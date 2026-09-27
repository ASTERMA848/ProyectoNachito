/**
 * Script de migración: actualiza el hash de contraseña del usuario admin
 * de "hardcoded" (valor especial del código legacy) a un hash bcrypt real.
 * 
 * Uso: node migrate-admin-password.js <nueva_contraseña>
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // Aceptar la nueva contraseña como argumento o usar prompt
  const newPassword = process.argv[2];

  if (!newPassword) {
    console.error("ERROR: Provee la nueva contraseña como argumento.");
    console.error("  node migrate-admin-password.js <nueva_contraseña>");
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error("ERROR: La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.updateMany({
    where: { username: "admin" },
    data: { passwordHash: hash },
  });

  if (updated.count === 0) {
    console.log("No se encontró el usuario admin. Creándolo...");
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash: hash,
        role: "ADMIN",
        isActive: true,
      },
    });
    console.log("✓ Usuario admin creado con contraseña segura.");
  } else {
    console.log("✓ Contraseña del usuario admin actualizada correctamente.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
