import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!await requireAuth()) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
      return NextResponse.json({ error: "Página inválida." }, { status: 400 });
    const account = await prisma.treasuryAccount.findUnique({ where: { id: params.id }, include: { currency: true } });
    if (!account) return NextResponse.json({ error: "La caja no existe." }, { status: 404 });
    const where = { treasuryAccountId: account.id };
    const [total, movements] = await prisma.$transaction([
      prisma.treasuryMovement.count({ where }),
      prisma.treasuryMovement.findMany({
        where, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        include: { operation: { select: { operationNumber: true } } },
      }),
    ]);
    return NextResponse.json({ account, movements, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error("Treasury history GET error:", error);
    return NextResponse.json({ error: "No se pudo cargar el historial de la caja." }, { status: 500 });
  }
}
