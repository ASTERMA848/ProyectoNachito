import OperationForm from "../OperationForm";

export default function NewOperationPage({ searchParams }: { searchParams: { type?: string } }) {
  return <OperationForm initialType={searchParams.type === "distributed" ? "DISTRIBUTED_SALE" : "SINGLE_SALE"} />;
}
