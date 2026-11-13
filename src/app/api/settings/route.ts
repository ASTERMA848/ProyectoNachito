import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/session";

import { lockAccountingWrites } from "@/lib/accounting-period";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const settings = await prisma.settings.findFirst() ?? { mainCurrencyId: null, accountingBlockDate: null };

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

    if (mainCurrencyId !== undefined && mainCurrencyId !== null && mainCurrencyId !== "") {
      const currency = typeof mainCurrencyId === "string" ? await prisma.currency.findUnique({ where: { id: mainCurrencyId } }) : null;
      if (!currency) {
        return NextResponse.json({ error: "La moneda principal no existe" }, { status: 400 });
      }
    }

    // La fecha de cierre es una fecha sin hora: se guarda como medianoche UTC, igual que operationDate.
    let parsedDate: Date | null = null;
    if (accountingBlockDate) {
      if (typeof accountingBlockDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(accountingBlockDate)) {
        return NextResponse.json({ error: "La fecha de cierre no es válida" }, { status: 400 });
      }
      parsedDate = new Date(`${accountingBlockDate}T00:00:00Z`);
      if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== accountingBlockDate) {
        return NextResponse.json({ error: "La fecha de cierre no es válida" }, { status: 400 });
      }
    }

    const settings = await prisma.$transaction(async (tx) => {
      await lockAccountingWrites(tx);
      const current = (await tx.settings.findFirst()) ?? (await tx.settings.create({ data: {} }));
      const settings = await tx.settings.update({
        where: { id: current.id },
        data: {
          mainCurrencyId: mainCurrencyId !== undefined ? mainCurrencyId || null : current.mainCurrencyId,
          accountingBlockDate: accountingBlockDate !== undefined ? parsedDate : current.accountingBlockDate,
        },
      });

      const code = async (id: string | null) => (id ? (await tx.currency.findUnique({ where: { id }, select: { code: true } }))?.code ?? null : null);
      const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          entity: "Settings",
          entityId: settings.id,
          oldValues: JSON.stringify({ mainCurrency: await code(current.mainCurrencyId), accountingBlockDate: day(current.accountingBlockDate) }),
          newValues: JSON.stringify({ mainCurrency: await code(settings.mainCurrencyId), accountingBlockDate: day(settings.accountingBlockDate) }),
        },
      });

      return settings;
    });

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error: any) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
