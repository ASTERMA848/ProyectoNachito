import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { contactInclude } from "@/lib/resources/contacts";

// Ficha del contacto con los contadores de sus botones inteligentes y sus saldos por moneda.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const contact = await prisma.contact.findFirst({ where: { id: params.id, deletedAt: null }, include: contactInclude });
    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    const [operations, accounts] = await Promise.all([
      prisma.operation.count({
        where: {
          deletedAt: null,
          parentOperationId: null,
          OR: [{ clientId: contact.id }, { providerId: contact.id }, { childOperations: { some: { clientId: contact.id, deletedAt: null } } }],
        },
      }),
      prisma.account.findMany({
        where: { contactId: contact.id },
        include: { currency: { select: { id: true, code: true, decimals: true } } },
        orderBy: { currency: { code: "asc" } },
      }),
    ]);

    return NextResponse.json({
      contact,
      counts: { operations },
      balances: accounts.map((account) => ({ accountId: account.id, currency: account.currency, balance: account.balance })),
    });
  } catch (error) {
    console.error("Contact GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

// Archivar o desarchivar: el contacto deja de aparecer en listas y selectores, sin borrarse.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!can(user, "contacts.write")) {
      return NextResponse.json({ error: "Tu rol no puede archivar contactos" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (typeof body?.isActive !== "boolean") {
      return NextResponse.json({ error: "Falta indicar si el contacto queda activo" }, { status: 400 });
    }

    const current = await prisma.contact.findFirst({ where: { id: params.id, deletedAt: null }, select: { id: true, isActive: true } });
    if (!current) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    const updated = await prisma.contact.update({ where: { id: current.id }, data: { isActive: body.isActive }, include: contactInclude });
    await logAudit({ userId: user.id, action: "UPDATE", entity: "Contact", entityId: current.id, oldValues: { isActive: current.isActive }, newValues: { isActive: updated.isActive } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Contact PATCH error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!can(user, "contacts.write")) {
      return NextResponse.json({ error: "Tu rol no puede modificar contactos" }, { status: 403 });
    }

    const contactId = params.id;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Extraer solo campos permitidos (evitar mass assignment)
    const {
      name, lastname, document, cuitCuil,
      phone, email, address, observations,
      isClient, isProvider, tagIds,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    if (email && typeof email === "string" && email.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "El email no tiene un formato válido" }, { status: 400 });
      }
    }

    const sanitizedTagIds: string[] = Array.isArray(tagIds)
      ? tagIds.filter((id) => typeof id === "string")
      : [];

    const oldContact = await prisma.contact.findFirst({
      where: { id: contactId, deletedAt: null },
      include: { tags: true },
    });

    if (!oldContact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
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
        // Las etiquetas se reemplazan solo si vienen en el pedido: sin tagIds quedan como estaban.
        ...(Array.isArray(tagIds)
          ? {
              tags: {
                deleteMany: {},
                create: sanitizedTagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
                })),
              },
            }
          : {}),
      },
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Contact",
      entityId: contactId,
      oldValues: {
        name: oldContact.name, lastname: oldContact.lastname, document: oldContact.document, cuitCuil: oldContact.cuitCuil,
        phone: oldContact.phone, email: oldContact.email, isClient: oldContact.isClient, isProvider: oldContact.isProvider,
      },
      newValues: {
        name: updatedContact.name, lastname: updatedContact.lastname, document: updatedContact.document, cuitCuil: updatedContact.cuitCuil,
        phone: updatedContact.phone, email: updatedContact.email, isClient: updatedContact.isClient, isProvider: updatedContact.isProvider,
      },
    });

    return NextResponse.json(updatedContact, { status: 200 });
  } catch (error: any) {
    console.error("Contact PUT error:", error);
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

    // Solo ADMIN puede eliminar contactos
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const contactId = params.id;
    const oldContact = await prisma.contact.findFirst({
      where: { id: contactId, deletedAt: null },
    });

    if (!oldContact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await logAudit({
      userId: user.id,
      action: "DELETE",
      entity: "Contact",
      entityId: contactId,
      oldValues: { name: oldContact.name },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Contact DELETE error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 400 });
  }
}
