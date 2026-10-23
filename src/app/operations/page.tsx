import { Suspense } from "react";
import OperationsList from "./OperationsList";

export default function OperationsPage() {
  // La lista lee los filtros de la URL (useSearchParams), que necesita un Suspense.
  return (
    <Suspense fallback={null}>
      <OperationsList />
    </Suspense>
  );
}
