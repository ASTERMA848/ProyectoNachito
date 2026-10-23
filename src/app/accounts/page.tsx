import { Suspense } from "react";
import AccountsList from "./AccountsList";

export default function AccountsPage() {
  // La lista lee los filtros de la URL (useSearchParams), que necesita un Suspense.
  return (
    <Suspense fallback={null}>
      <AccountsList />
    </Suspense>
  );
}
