import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/session";
import { hashPassword } from "@/lib/auth-utils";
import { logAudit } from "@/lib/audit";

const ALLOWED_ROLES = ["ADMIN", "AUDITOR", "OPERATOR"];
const ALLOWED_THEMES = ["SYSTEM", "LIGHT", "DARK"];

/**
 * PUT /api/users/[id] — Actualizar datos de un usuario.
 * Un usuario puede editar su propio perfil (username, password, theme, foto).
 * Solo ADMIN puede cambiar el rol o editar a otros usuarios.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const loggedUser = await requireAuth();
    if (!loggedUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = params;

    // Un usuario solo puede editarse a sí mismo, salvo que sea ADMIN
    if (loggedUser.role !== "ADMIN" && loggedUser.id !== id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Extraer solo campos permitidos (mass assignment protection)
    const { username, role, password, theme, profilePicture } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 64) {
      return NextResponse.json({ error: "El nombre de usuario debe tener entre 3 y 64 caracteres" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_.\-]+$/.test(trimmedUsername)) {
      return NextResponse.json({ error: "Nombre de usuario contiene caracteres inválidos" }, { status: 400 });
    }

    if (password !== undefined && password !== null && password !== "") {
      if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        return NextResponse.json({ error: "La contraseña debe tener entre 8 y 128 caracteres" }, { status: 400 });
      }
    }

    // Solo ADMIN puede cambiar el rol
    let finalRole: string | undefined;
    if (role !== undefined) {
      if (loggedUser.role !== "ADMIN") {
        return NextResponse.json({ error: "Solo el administrador puede cambiar roles" }, { status: 403 });
      }
      if (!ALLOWED_ROLES.includes(role)) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      finalRole = role;
    }

    // Validar theme si se provee
    if (theme !== undefined && !ALLOWED_THEMES.includes(theme)) {
      return NextResponse.json({ error: "Tema inválido" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verificar username duplicado
    const duplicateUser = await prisma.user.findFirst({
      where: { username: trimmedUsername, id: { not: id } },
    });
    if (duplicateUser) {
      return NextResponse.json({ error: "El nombre de usuario ya está registrado" }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      username: trimmedUsername,
      role: finalRole ?? targetUser.role,
      theme: ALLOWED_THEMES.includes(theme) ? theme : targetUser.theme,
    };

    // Solo actualizar profilePicture si se provee explícitamente
    if (profilePicture !== undefined) {
      // Validar que sea una URL relativa del sistema (no permitir URLs externas)
      if (profilePicture !== null && typeof profilePicture === "string") {
        if (!profilePicture.startsWith("/uploads/profiles/")) {
          return NextResponse.json({ error: "URL de imagen inválida" }, { status: 400 });
        }
        updateData.profilePicture = profilePicture;
      } else {
        updateData.profilePicture = null;
      }
    }

    if (password && password.trim() !== "") {
      updateData.passwordHash = await hashPassword(password);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: loggedUser.id,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      oldValues: { username: targetUser.username, role: targetUser.role },
      newValues: { username: updatedUser.username, role: updatedUser.role },
    });

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        theme: updatedUser.theme,
        profilePicture: updatedUser.profilePicture,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

/**
 * PATCH /api/users/[id] — Activar/pausar usuario (solo ADMIN).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Falta campo isActive (boolean)" }, { status: 400 });
    }

    const { isActive } = body;

    // Un admin no puede pausarse a sí mismo
    if (id === admin.id && !isActive) {
      return NextResponse.json(
        { error: "No puedes pausar tu propio usuario administrador" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      oldValues: { isActive: targetUser.isActive },
      newValues: { isActive: updatedUser.isActive },
    });

    // Si pausamos el usuario, destruimos todas sus sesiones activas
    if (!isActive) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error) {
    console.error("Patch user error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
