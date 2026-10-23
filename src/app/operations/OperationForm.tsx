"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button, EmptyState, HistoryPanel, Spinner, iconSize, type HistoryGroup } from "@/components/ui";
import { Inbox } from "lucide-react";
import { isSale } from "@/lib/operation-labels";
import { SaleForm } from "./SaleForm";
import { StandardForm } from "./StandardForm";
import { fetchJson, type ContactOption, type Currency, type OperationDetailResponse } from "./types";
import styles from "./form.module.css";

type OperationFormProps = { id?: string; initialType?: "SINGLE_SALE" | "DISTRIBUTED_SALE" };

// Carga la operación (o arma una nueva) y elige el formulario según el tipo.
export default function OperationForm({ id, initialType = "SINGLE_SALE" }: OperationFormProps) {
  const router = useRouter();
  const detail = useSWR<OperationDetailResponse>(id ? `/api/operations/${id}` : null, fetchJson);
  const contacts = useSWR<{ contacts: ContactOption[] }>("/api/contacts?options=1", fetchJson);
  const currencies = useSWR<{ currencies: Currency[] }>("/api/currencies", fetchJson);
  const history = useSWR<{ groups: HistoryGroup[] }>(id ? `/api/history?entity=Operation&id=${id}` : null, fetchJson);

  // Una línea de venta distribuida se abre en su operación agrupadora.
  const parentId = detail.data?.operation.parentOperation?.id;
  useEffect(() => {
    if (parentId) router.replace(`/operations/${parentId}`);
  }, [parentId, router]);

  const error = detail.error ?? contacts.error ?? currencies.error;
  if (error) {
    return (
      <EmptyState icon={<Inbox size={iconSize.lg} />} title="No se pudo abrir la operación" action={<Button onClick={() => router.push("/operations")}>Volver a Operaciones</Button>}>
        {error.message}
      </EmptyState>
    );
  }
  if ((id && !detail.data) || !contacts.data || !currencies.data || parentId) {
    return (
      <div className={styles.page} aria-busy="true">
        <EmptyState icon={<Spinner label="Cargando la operación" size="lg" />} title="Cargando la operación" />
      </div>
    );
  }

  const refresh = async (savedId?: string) => {
    if (!id && savedId) return router.replace(`/operations/${savedId}`);
    await Promise.all([detail.mutate(), history.mutate()]);
  };

  const historyPanel = id ? <HistoryPanel groups={history.data?.groups ?? []} emptyText="Todavía no hay cambios registrados." /> : undefined;
  const operation = detail.data?.operation;

  if (operation && !isSale(operation.type)) {
    return <StandardForm detail={detail.data!} contacts={contacts.data.contacts} currencies={currencies.data.currencies} history={historyPanel} onSaved={() => refresh()} />;
  }
  return (
    <SaleForm
      detail={detail.data}
      initialType={initialType}
      contacts={contacts.data.contacts}
      currencies={currencies.data.currencies}
      history={historyPanel}
      onSaved={(savedId) => refresh(savedId)}
    />
  );
}
