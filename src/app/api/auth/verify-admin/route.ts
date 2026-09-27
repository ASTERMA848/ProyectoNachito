import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { verifyPassword } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

/**
 * Verifica la contraseña del administrador actual.
 * Requiere sesión activa con rol ADMIN.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json(
        { success: false, error: "Contraseña de administrador incorrecta" },
        { status: 401 }
      );
    }

    // Obtener el hash real del usuario
    const adminUser = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { passwordHash: true },
    });

    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: "Contraseña de administrador incorrecta" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, adminUser.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Contraseña de administrador incorrecta" },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin verification error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
