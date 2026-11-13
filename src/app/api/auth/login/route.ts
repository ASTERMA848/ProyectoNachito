import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import prisma from "@/lib/prisma";
import { hashPassword, verifyPassword, isLegacyHash, generateToken } from "@/lib/auth-utils";
import { clearAuthAttempts, consumeAuthAttempt } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // El proxy configurado debe reemplazar este encabezado antes de reenviar.
    const proxyIp = process.env.TRUST_PROXY === "true" ? request.headers.get("x-real-ip")?.trim() : undefined;
    const ip = proxyIp && isIP(proxyIp) ? proxyIp : null;
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Limitar longitud para evitar DoS en bcrypt
    if (username.length > 64 || password.length > 128) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const sourceLimit = await consumeAuthAttempt(`login:source:${ip ?? "direct"}`, 60);
    const userKey = `login:user:${username.toLowerCase()}`;
    const userLimit = sourceLimit || await consumeAuthAttempt(userKey, 5);
    if (userLimit) return NextResponse.json(
      { error: "Demasiados intentos. Intente más tarde." },
      { status: 429, headers: { "Retry-After": String(userLimit) } }
    );

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      // Tiempo constante para evitar enumeración de usuarios
      await hashPassword("dummy-constant-time");
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid || !user.isActive || (process.env.NODE_ENV === "production" && user.role === "ADMIN" && password === "admin")) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const upgradedHash = isLegacyHash(user.passwordHash) && Buffer.byteLength(password) <= 72
      ? await hashPassword(password)
      : null;
    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE id = ${user.id} AND "passwordHash" = ${user.passwordHash}
        AND "isActive" = true FOR UPDATE
      `;
      if (!locked.length) return false;
      if (upgradedHash) await tx.user.update({ where: { id: user.id }, data: { passwordHash: upgradedHash } });
      await clearAuthAttempts(userKey, tx);
      await tx.session.create({
        data: { userId: user.id, sessionToken, expiresAt },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "Session",
          ipAddress: ip,
          newValues: JSON.stringify({ username: user.username }),
        },
      });
      return true;
    });
    if (!created) return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    });

    response.cookies.set("sessionToken", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
