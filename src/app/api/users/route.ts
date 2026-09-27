import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrAuditor, requireAdmin } from "@/lib/session";
import { hashPassword } from "@/lib/auth-utils";
import { logAudit } from "@/lib/audit";

const ALLOWED_ROLES = ["ADMIN", "AUDITOR", "OPERATOR"];

export async function GET() {
  try {
    const user = await requireAdminOrAuditor();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Solo ADMIN puede crear usuarios
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Extraer solo los campos esperados (evitar mass assignment)
    const { username, password, role } = body;

    if (!username || !password || !role) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Validar tipos
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string"
    ) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 64) {
      return NextResponse.json(
        { error: "El nombre de usuario debe tener entre 3 y 64 caracteres" },
        { status: 400 }
      );
    }

    // Validar caracteres del username
    if (!/^[a-zA-Z0-9_.\-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: "El nombre de usuario solo puede contener letras, números, _, . y -" },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: "La contraseña debe tener entre 8 y 128 caracteres" },
        { status: 400 }
      );
    }

    // Validar rol contra lista permitida (evitar escalamiento de privilegios)
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "El nombre de usuario ya está registrado" },
        { status: 400 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        username: trimmedUsername,
        passwordHash: await hashPassword(password),
        role,
        theme: "SYSTEM",
        isActive: true,
      },
    });

    await logAudit({
      userId: admin.id,
      action: "CREATE",
      entity: "User",
      entityId: newUser.id,
      newValues: { username: newUser.username, role: newUser.role },
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        isActive: newUser.isActive,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
