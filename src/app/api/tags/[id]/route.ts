import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { name, color } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    if (name.trim().length > 50) {
      return NextResponse.json({ error: "El nombre no puede superar los 50 caracteres" }, { status: 400 });
    }

    let safeColor = "#3b82f6";
    if (color && typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color)) {
      safeColor = color;
    }

    const existingTag = await prisma.tag.findUnique({ where: { id } });
    if (!existingTag) {
      return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 });
    }

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: {
        name: name.trim().substring(0, 50),
        color: safeColor,
      },
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Tag",
      entityId: id,
      oldValues: { name: existingTag.name },
      newValues: { name: updatedTag.name },
    });

    return NextResponse.json(updatedTag);
  } catch (error: any) {
    console.error("Tag PUT error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una etiqueta con ese nombre." }, { status: 409 });
    }
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = params;

    const existingTag = await prisma.tag.findUnique({ where: { id } });
    if (!existingTag) {
      return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 });
    }

    await prisma.contactTag.deleteMany({ where: { tagId: id } });
    await prisma.tag.delete({ where: { id } });

    await logAudit({
      userId: user.id,
      action: "DELETE",
      entity: "Tag",
      entityId: id,
      oldValues: { name: existingTag.name },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Tag DELETE error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
