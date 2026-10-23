import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { accountInclude } from "@/lib/resources/accounts";

export const dynamic = "force-dynamic";

// Encabezado de la cuenta corriente: contacto, moneda y saldo.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const account = await prisma.account.findFirst({ where: { id: params.id, contact: { deletedAt: null } }, include: accountInclude });
    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ account });
  } catch (error) {
    console.error("Account GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
