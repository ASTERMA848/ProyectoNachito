import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ tags });
  } catch (error: any) {
    console.error("Tags GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { name, color } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: "El nombre de la etiqueta no puede superar los 50 caracteres" },
        { status: 400 }
      );
    }

    // Validar color hex si se provee
    let safeColor = "#3b82f6";
    if (color && typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color)) {
      safeColor = color;
    }

    const newTag = await prisma.tag.create({
      data: {
        name: name.trim().substring(0, 50),
        color: safeColor,
      },
    });

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entity: "Tag",
      entityId: newTag.id,
      newValues: { name: newTag.name },
    });

    return NextResponse.json(newTag, { status: 201 });
  } catch (error: any) {
    console.error("Tags POST error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una etiqueta con ese nombre." }, { status: 409 });
    }
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
