import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const operationId = params.id;

    const logs = await prisma.auditLog.findMany({
      where: {
        entity: "Operation",
        entityId: operationId,
      },
      include: {
        user: {
          select: { username: true, role: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(logs, { status: 200 });
  } catch (error: any) {
    console.error("Operation History GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
