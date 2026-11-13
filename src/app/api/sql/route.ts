import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAdminOrAuditor } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_ROWS = 1000;
const STATEMENT_TIMEOUT_MS = 5000;
let reportingDb: PrismaClient | undefined;

function getReportingDb() {
  const url = process.env.SQL_REPORTING_DATABASE_URL;
  if (!url) return null;
  reportingDb ??= new PrismaClient({ datasourceUrl: url });
  return reportingDb;
}

// Comandos de escritura / destructivos. La transacción READ ONLY es la barrera real;
// esta lista da un mensaje claro antes de llegar a la base.
const WRITE_PATTERNS = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bDROP\b/i,
  /\bALTER\b/i,
  /\bTRUNCATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXEC\b/i,
  /\bEXECUTE\b/i,
  /\bCREATE\b/i,
  /\bREPLACE\b/i,
  /\bCOPY\b/i,
  /\bINTO\b/i,
  /\bLOCK\b/i,
];

// Datos sensibles y funciones peligrosas de PostgreSQL.
const FORBIDDEN_PATTERNS = [
  /\bsession\b/i,       // tabla "Session" (tokens de sesión activos)
  /\bsessiontoken\b/i,
  /"user"/i,            // tabla "User" (hashes de contraseña)
  /\bpasswordhash\b/i,
  /\bpg_\w*/i,          // pg_catalog, pg_read_file, pg_sleep, pg_terminate_backend...
  /\bu&/i,              // identificadores con escapes unicode (U&"...")
  /\w*_to_xml\w*/i,     // query_to_xml, table_to_xml, database_to_xml: ejecutan SQL dinámico
  /\bts_(stat|rewrite)\b/i, // también reciben consultas como texto
  /\bdblink\w*/i,
  /\blo_\w+/i,          // large objects (lo_import / lo_export)
  /\b(set_config|current_setting)\b/i,
];

function blocked(query: string): string | null {
  if (query.includes(";")) return "Solo se permite una consulta por vez.";
  if (/--|\/\*/.test(query)) return "La consulta debe estar sin comentarios.";
  if (!/^SELECT\b/i.test(query)) return "Solo se permiten consultas SELECT.";
  if (WRITE_PATTERNS.some((p) => p.test(query))) return "Solo se permiten consultas de lectura (SELECT).";
  if (FORBIDDEN_PATTERNS.some((p) => p.test(query))) return "La consulta accede a datos o funciones no permitidos.";
  return null;
}

// count(*) y similares devuelven BigInt, que JSON.stringify no soporta.
function toJson(value: unknown) {
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}

// Solo AUDITOR y ADMIN pueden ejecutar SQL
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdminOrAuditor();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim().replace(/;\s*$/, "").trim() : "";

    if (!query) {
      return NextResponse.json({ error: "Consulta SQL inválida." }, { status: 400 });
    }

    // Limitar longitud de consulta
    if (query.length > 4000) {
      return NextResponse.json({ error: "Consulta demasiado larga." }, { status: 400 });
    }

    const reason = blocked(query);
    if (reason) {
      await logAudit({
        userId: user.id,
        action: "SQL_QUERY",
        query: `[BLOQUEADO] ${query.substring(0, 500)}`,
      });
      return NextResponse.json({ error: reason }, { status: 403 });
    }

    // Transacción de solo lectura con tiempo máximo; envolver la consulta como
    // subconsulta garantiza una única sentencia SELECT y limita las filas.
    const db = getReportingDb();
    if (!db) return NextResponse.json({ error: "La consola requiere una conexión de informes configurada." }, { status: 503 });
    let result: unknown;
    try {
      result = await db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
          await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
          await tx.$executeRawUnsafe("SET LOCAL search_path = calce_reporting, pg_catalog");
          const [access] = await tx.$queryRaw<{ allowed: boolean }[]>`
            SELECT current_user = 'calce_report_reader' AND NOT EXISTS (
              SELECT 1 FROM pg_catalog.pg_class AS relation
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
              WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
                AND has_any_column_privilege(current_user, relation.oid, 'SELECT')
            ) AS allowed`;
          if (!access?.allowed) throw new Error("El rol de informes tiene permisos incorrectos.");
          return tx.$queryRawUnsafe(`SELECT * FROM (\n${query}\n) AS consulta LIMIT ${MAX_ROWS}`);
        },
        { maxWait: 5000, timeout: STATEMENT_TIMEOUT_MS + 5000 }
      );
    } catch (error) {
      await logAudit({ userId: user.id, action: "SQL_QUERY", query: `[ERROR] ${query.slice(0, 500)}` });
      throw error;
    }

    await logAudit({
      userId: user.id,
      action: "SQL_QUERY",
      query: query.substring(0, 1000),
    });

    return new NextResponse(toJson({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // No exponer detalles del error de DB al cliente
    console.error("SQL query error:", error);
    return NextResponse.json(
      { error: "Error al ejecutar la consulta." },
      { status: 500 }
    );
  }
}
