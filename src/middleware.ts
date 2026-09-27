import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware de Next.js — se ejecuta en el Edge antes de cada request.
 * IMPORTANTE: El Edge runtime NO soporta Prisma/Node.js APIs.
 * La validación completa de sesión ocurre en cada route handler.
 * Este middleware solo verifica PRESENCIA de cookie y aplica security headers.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rutas completamente públicas ─────────────────────────────────────────
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads/");

  const response = isPublic
    ? NextResponse.next()
    : (() => {
        const token = request.cookies.get("sessionToken")?.value;
        if (!token) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              { error: "No autenticado" },
              { status: 401 }
            );
          }
          return NextResponse.redirect(new URL("/login", request.url));
        }
        return NextResponse.next();
      })();

  // ── Security Headers en TODAS las respuestas ──────────────────────────────
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
