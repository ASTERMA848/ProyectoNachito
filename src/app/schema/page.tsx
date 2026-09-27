import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import SchemaDiagram from "@/components/SchemaDiagram";
import { GlassCard } from "@liquefy-ui/react";

export const metadata = {
  title: "Diagrama ER | Agencia de Cambio",
};

export default async function SchemaPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Solo ADMIN y AUDITOR pueden ver el diagrama ER
  if (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR") {
    redirect("/");
  }

  // Extraer el modelo de datos de Prisma (estructura técnica de la BD)
  const models = Prisma.dmmf.datamodel.models as unknown as any[];

  return (
    <>
      <div className="animate-fade-in" style={{ padding: "0.5rem 0" }}>
        <div style={{ marginBottom: "1.75rem" }}>
          <div>
            <span className="section-eyebrow">ARQUITECTURA DE DATOS</span>
            <h1 className="flowbite-title">Diagrama Entidad-Relación (ER)</h1>
            <p style={{ color: "var(--color-ash)", fontSize: "14px" }}>
              Tablero interactivo de la arquitectura de la base de datos. Generado automáticamente a partir del esquema.
            </p>
          </div>
        </div>

        <GlassCard style={{ padding: "16px", marginTop: "24px", overflowX: "auto" }}>
          <SchemaDiagram models={models} />
        </GlassCard>
      </div>
    </>
  );
}
