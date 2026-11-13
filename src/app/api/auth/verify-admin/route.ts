import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { verifyPassword } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { clearAuthAttempts, consumeAuthAttempt } from "@/lib/rate-limit";

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
    const key = `verify-admin:${admin.id}`;
    const retryAfter = await consumeAuthAttempt(key, 10);
    if (retryAfter) return NextResponse.json(
      { error: "Demasiados intentos. Intente más tarde." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );

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

    await clearAuthAttempts(key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin verification error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
