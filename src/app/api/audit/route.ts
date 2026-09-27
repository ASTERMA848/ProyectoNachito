import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrAuditor } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAdminOrAuditor();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const auditLogs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ auditLogs });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
