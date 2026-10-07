import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { recordManualTreasuryMovement, TreasuryError } from "@/lib/manual-treasury";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const [accounts, movements] = await Promise.all([prisma.treasuryAccount.findMany({
      where: { isActive: true },
      include: { currency: true },
      orderBy: { name: "asc" },
    }), prisma.treasuryMovement.findMany({
      take: 100,
      orderBy: { date: "desc" },
      include: {
        account: { include: { currency: true } },
        operation: { select: { operationNumber: true } }
      }
    })]);

    return NextResponse.json({ accounts, movements, canManage: user.role === "ADMIN" || user.role === "OPERATOR" }, { status: 200 });
  } catch (error) {
    console.error("Treasury GET error:", error);
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "ADMIN" && user.role !== "OPERATOR")
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
