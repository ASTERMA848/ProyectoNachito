import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { recordManualTreasuryMovement, TreasuryError } from "@/lib/manual-treasury";
import { can } from "@/lib/permissions";
import { MAX_SERIES_DAYS, treasuryDashboard } from "@/lib/resources/treasury";

export const dynamic = "force-dynamic";

// Tablero de tesorería: ?days=30 (máximo 90) para la serie de saldos de cada caja.
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const days = Math.min(MAX_SERIES_DAYS, Math.max(2, Math.trunc(Number(req.nextUrl.searchParams.get("days")) || 30)));
    return NextResponse.json(await treasuryDashboard(days), { status: 200 });
  } catch (error) {
    console.error("Treasury GET error:", error);
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!can(user, "treasury.write"))
      return NextResponse.json({ error: "No tenés permiso para registrar movimientos." }, { status: 403 });
    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Los datos del movimiento no son válidos." }, { status: 400 }); }
    const result = await prisma.$transaction(tx => recordManualTreasuryMovement(tx, body, user.id));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TreasuryError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Treasury POST error:", error);
    return NextResponse.json({ error: "No se pudo registrar el movimiento. Intentá nuevamente." }, { status: 500 });
  }
}
