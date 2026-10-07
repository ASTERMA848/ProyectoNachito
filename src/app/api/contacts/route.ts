import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (req.nextUrl.searchParams.get("options") === "1") {
      const contacts = await prisma.contact.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, document: true, isClient: true, isProvider: true, isActive: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ contacts });
    }
    const contacts = await prisma.contact.findMany({
      where: { deletedAt: null },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    });

    const formatted = contacts.map((c) => ({
      ...c,
      tags: c.tags.map((t) => t.tag.name),
    }));

    return NextResponse.json({ contacts: formatted });
  } catch (error: any) {
    console.error("Contacts GET error:", error);
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

    // Extraer solo campos esperados (evitar mass assignment)
    const {
      name,
      lastname,
      document,
      cuitCuil,
      phone,
      email,
      address,
      observations,
      isClient,
      isProvider,
      tagIds,
    } = body;

    // Validar nombre requerido
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    if (name.trim().length > 200) {
      return NextResponse.json({ error: "El nombre no puede superar los 200 caracteres" }, { status: 400 });
    }

    // Validar email si se provee
    if (email && typeof email === "string" && email.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "El email no tiene un formato válido" }, { status: 400 });
      }
    }

    // Validar que tagIds sea array de strings si se provee
    if (tagIds !== undefined && !Array.isArray(tagIds)) {
      return NextResponse.json({ error: "tagIds debe ser un array" }, { status: 400 });
    }

    const sanitizedTagIds: string[] = Array.isArray(tagIds)
      ? tagIds.filter((id) => typeof id === "string")
      : [];

    const newContact = await prisma.contact.create({
      data: {
        name: String(name).trim().substring(0, 200),
        lastname: lastname ? String(lastname).trim().substring(0, 200) : null,
        document: document ? String(document).trim().substring(0, 50) : null,
        cuitCuil: cuitCuil ? String(cuitCuil).trim().substring(0, 20) : null,
        phone: phone ? String(phone).trim().substring(0, 30) : null,
        email: email ? String(email).trim().substring(0, 254) : null,
        address: address ? String(address).trim().substring(0, 500) : null,
        observations: observations ? String(observations).trim().substring(0, 2000) : null,
        isClient: Boolean(isClient),
        isProvider: Boolean(isProvider),
        tags: {
          create: sanitizedTagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
    });

    await logAudit({
      userId: user.id,
      action: "CREATE",
      entity: "Contact",
      entityId: newContact.id,
      newValues: { name: newContact.name, isClient: newContact.isClient, isProvider: newContact.isProvider },
    });

    return NextResponse.json(newContact, { status: 201 });
  } catch (error: any) {
    console.error("Contacts POST error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
