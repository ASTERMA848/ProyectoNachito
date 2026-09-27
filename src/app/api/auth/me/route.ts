import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
        theme: session.user.theme,
        profilePicture: session.user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
