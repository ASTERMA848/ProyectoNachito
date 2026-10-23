import { Suspense } from "react";
import UsersList from "./UsersList";

export default function UsersPage() {
  // La lista lee los filtros de la URL (useSearchParams), que necesita un Suspense.
  return (
    <Suspense fallback={null}>
      <UsersList />
    </Suspense>
  );
}
