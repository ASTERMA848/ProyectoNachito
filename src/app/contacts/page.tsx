import { Suspense } from "react";
import ContactsList from "./ContactsList";

export default function ContactsPage() {
  // La lista lee los filtros de la URL (useSearchParams), que necesita un Suspense.
  return (
    <Suspense fallback={null}>
      <ContactsList />
    </Suspense>
  );
}
