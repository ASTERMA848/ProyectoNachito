/**
 * Script de migración: actualiza el hash de contraseña del usuario admin
 * de "hardcoded" (valor especial del código legacy) a un hash bcrypt real.
 * 
 * Definí INITIAL_ADMIN_PASSWORD en el entorno y ejecutá node migrate-admin-password.js.
 */
require("@next/env").loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const newPassword = process.env.INITIAL_ADMIN_PASSWORD || process.argv[2];

  if (!newPassword) {
    console.error("ERROR: Configurá INITIAL_ADMIN_PASSWORD.");
    process.exit(1);
  }

  if (newPassword.length < 12 || Buffer.byteLength(newPassword) > 72) {
    console.error("ERROR: La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    const admin = await tx.user.findUnique({ where: { username: "admin" } });
    if (admin?.role !== "ADMIN") throw new Error("El usuario admin con rol ADMIN no existe.");
    await tx.user.update({ where: { id: admin.id }, data: { passwordHash: hash } });
    await tx.session.deleteMany({ where: { userId: admin.id } });
    await tx.auditLog.create({ data: {
      action: "UPDATE",
      entity: "User",
      entityId: admin.id,
      newValues: JSON.stringify({ password: "actualizada por mantenimiento" }),
    } });
  });
  console.log("✓ Contraseña actualizada y sesiones anteriores cerradas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
