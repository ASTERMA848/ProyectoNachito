import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const accountId = params.id;

    // Verificar que la cuenta existe antes de listar transacciones (evitar IDOR)
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { accountId },
      orderBy: { date: "desc" },
      take: 500, // Limitar resultados
    });

    return NextResponse.json({ transactions }, { status: 200 });
  } catch (error: any) {
    console.error("Transactions GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
