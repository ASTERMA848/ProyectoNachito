import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: {},
      });
    }

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error: any) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { mainCurrencyId, accountingBlockDate } = body;

    let parsedDate: Date | null = null;
    if (accountingBlockDate) {
      const d = new Date(accountingBlockDate);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          mainCurrencyId: mainCurrencyId || null,
          accountingBlockDate: parsedDate,
        },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          mainCurrencyId: mainCurrencyId !== undefined ? mainCurrencyId : settings.mainCurrencyId,
          accountingBlockDate: parsedDate,
        },
      });
    }

    // Registrar en auditoría
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entity: "Settings",
        entityId: settings.id,
        newValues: JSON.stringify({
          mainCurrencyId: settings.mainCurrencyId,
          accountingBlockDate: settings.accountingBlockDate,
        }),
      },
    });

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error: any) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
