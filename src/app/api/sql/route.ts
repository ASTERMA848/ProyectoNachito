import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrAuditor } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Solo AUDITOR y ADMIN pueden ejecutar SQL
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdminOrAuditor();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json({ error: "Consulta SQL inválida." }, { status: 400 });
    }

    // Limitar longitud de consulta
    if (query.length > 4000) {
      return NextResponse.json({ error: "Consulta demasiado larga." }, { status: 400 });
    }

    // Validación de solo lectura — bloquear comandos escritura/destructivos
    const upperQuery = query.toUpperCase();
    const blockedPatterns = [
      /\bINSERT\b/,
      /\bUPDATE\b/,
      /\bDELETE\b/,
      /\bDROP\b/,
      /\bALTER\b/,
      /\bTRUNCATE\b/,
      /\bGRANT\b/,
      /\bREVOKE\b/,
      /\bEXEC\b/,
      /\bEXECUTE\b/,
      /\bCREATE\b/,
      /\bREPLACE\b/,
      /\bATTACH\b/,
      /\bDETACH\b/,
      /\bPRAGMA\b/,  // Bloquear pragmas de SQLite que pueden modificar estado
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(upperQuery)) {
        await logAudit({
          userId: user.id,
          action: "SQL_QUERY",
          query: `[BLOQUEADO] ${query.substring(0, 500)}`,
        });
        return NextResponse.json(
          { error: "Solo se permiten consultas de lectura (SELECT)." },
          { status: 403 }
        );
      }
    }

    // Solo permitir SELECT explícitamente
    if (!upperQuery.trimStart().startsWith("SELECT")) {
      await logAudit({
        userId: user.id,
        action: "SQL_QUERY",
        query: `[BLOQUEADO - NO SELECT] ${query.substring(0, 500)}`,
      });
      return NextResponse.json(
        { error: "Solo se permiten consultas SELECT." },
        { status: 403 }
      );
    }

    const result = await prisma.$queryRawUnsafe(query);

    await logAudit({
      userId: user.id,
      action: "SQL_QUERY",
      query: query.substring(0, 1000),
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    // No exponer detalles del error de DB al cliente
    console.error("SQL query error:", error);
    return NextResponse.json(
      { error: "Error al ejecutar la consulta." },
      { status: 500 }
    );
  }
}
