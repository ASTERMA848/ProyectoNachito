import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const accounts = await prisma.treasuryAccount.findMany({
      where: { isActive: true },
      include: { currency: true },
      orderBy: { name: "asc" },
    });

    const movements = await prisma.treasuryMovement.findMany({
      take: 100,
      orderBy: { date: "desc" },
      include: {
        account: { include: { currency: true } },
        operation: { select: { operationNumber: true } }
      }
    });

    return NextResponse.json({ accounts, movements }, { status: 200 });
  } catch (error) {
    console.error("Treasury GET error:", error);
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}

