import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("sessionToken")?.value;

    if (token) {
      await prisma.session.deleteMany({ where: { sessionToken: token } });
    }

    const response = NextResponse.json({ success: true });

    // Expirar la cookie correctamente
    response.cookies.set("sessionToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
