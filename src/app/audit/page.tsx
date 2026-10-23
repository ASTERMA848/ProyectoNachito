import { Suspense } from "react";
import AuditList from "./AuditList";

export default function AuditPage() {
  // La lista lee los filtros de la URL (useSearchParams), que necesita un Suspense.
  return (
    <Suspense fallback={null}>
      <AuditList />
    </Suspense>
  );
}
