/**
 * Módulo centralizado de resolución de sesión.
 * Todos los route handlers deben importar getSession desde aquí
 * para evitar duplicación y asegurar consistencia.
 */
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export type SessionUser = {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  theme: string;
  profilePicture: string | null;
};

export type Session = {
  user: SessionUser;
};

/**
 * Resuelve la sesión actual a partir de la cookie.
 * Retorna null si no hay sesión válida o el usuario está inactivo.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const token = cookies().get("sessionToken")?.value;
    if (!token) return null;

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true,
            theme: true,
            profilePicture: true,
          },
        },
      },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) return null;
    if (!session.user.isActive) return null;

    return { user: session.user };
  } catch {
    return null;
  }
}

/**
 * Require una sesión válida con rol ADMIN.
 */
export async function requireAdmin(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.user.role !== "ADMIN") return null;
  return session.user;
}

/**
 * Require una sesión válida con rol ADMIN o AUDITOR.
 */
export async function requireAdminOrAuditor(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR")
    return null;
  return session.user;
}

/**
 * Require cualquier sesión válida.
 */
export async function requireAuth(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}
