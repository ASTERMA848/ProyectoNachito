import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { can } from "@/lib/permissions";
import { ListError, parseListParams } from "@/lib/list-query";
import { GROUP_KEYS, listAudit, SORT_KEYS } from "@/lib/resources/audit";

export const dynamic = "force-dynamic";

// Contrato de listas: ?q=&filter=action:DELETE&filter=entity:Operation&filter=user:<id>&filter=date:today&groupBy=entity
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!can(user, "audit.read")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Opciones del filtro de usuarios.
    if (req.nextUrl.searchParams.get("options") === "users") {
      const users = await prisma.user.findMany({ select: { id: true, username: true }, orderBy: { username: "asc" } });
      return NextResponse.json({ users });
    }

    const params = parseListParams(req.nextUrl.searchParams, { sortKeys: SORT_KEYS, groupKeys: GROUP_KEYS });
    return NextResponse.json(await listAudit(params));
  } catch (error) {
    if (error instanceof ListError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Fetch audit logs error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
