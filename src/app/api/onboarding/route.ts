import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/onboarding
// Estado real de los primeros pasos: cada bandera sale de la base, nunca de un
// "marcar como hecho" que el usuario pueda tildar sin haberlo hecho.
export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [operationCount, transactionCount, treasuryMovementCount, settings, teamCount] =
      await Promise.all([
        prisma.operation.count(),
        prisma.transaction.count(),
        prisma.treasuryMovement.count(),
        prisma.settings.findFirst(),
        prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      ]);

    return NextResponse.json({
      hasOperation: operationCount > 0,
      hasAccountMovement: transactionCount > 0,
      hasTreasuryMovement: treasuryMovementCount > 0,
      hasMainCurrency: Boolean(settings?.mainCurrencyId),
      hasTeam: teamCount > 1,
    });
  } catch (error) {
    console.error("Onboarding GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
