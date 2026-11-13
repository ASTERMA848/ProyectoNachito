import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/list-query";
import { accountMovements } from "@/lib/resources/accounts";

export const dynamic = "force-dynamic";

// Movimientos de la cuenta, del más nuevo al más viejo: ?offset=0&limit=80
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verificar que la cuenta existe antes de listar transacciones (evitar IDOR)
    const account = await prisma.account.findUnique({ where: { id: (await params).id }, select: { id: true } });
    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    const offset = Math.max(0, Math.trunc(Number(req.nextUrl.searchParams.get("offset")) || 0));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(req.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT)));
    return NextResponse.json(await accountMovements(account.id, offset, limit));
  } catch (error: any) {
    console.error("Transactions GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
