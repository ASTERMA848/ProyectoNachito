import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/list-query";
import { treasuryMovements } from "@/lib/resources/treasury";

export const dynamic = "force-dynamic";

// Movimientos de una caja, del más nuevo al más viejo: ?offset=0&limit=80
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAuth()) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const offset = Math.min(1_000_000, Math.max(0, Math.trunc(Number(req.nextUrl.searchParams.get("offset")) || 0)));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(req.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT)));
    const result = await treasuryMovements((await params).id, offset, limit);
    if (!result) return NextResponse.json({ error: "La caja no existe." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Treasury history GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar el historial de la caja." }, { status: 500 });
  }
}
