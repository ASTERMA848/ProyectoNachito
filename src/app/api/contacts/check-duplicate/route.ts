import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { findDuplicateContacts } from "@/lib/resources/contacts";

export const dynamic = "force-dynamic";

// GET /api/contacts/check-duplicate?document=&cuitCuil=&email=&excludeId=
// Aviso antes de guardar, no una validación que bloquee: la pantalla decide si lo muestra.
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const params = req.nextUrl.searchParams;
    const matches = await findDuplicateContacts({
      document: params.get("document"),
      cuitCuil: params.get("cuitCuil"),
      email: params.get("email"),
      excludeId: params.get("excludeId") ?? undefined,
    });
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Contacts check-duplicate GET error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
