import OperationForm from "../OperationForm";

export default async function NewOperationPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  return <OperationForm initialType={(await searchParams).type === "distributed" ? "DISTRIBUTED_SALE" : "SINGLE_SALE"} />;
}
