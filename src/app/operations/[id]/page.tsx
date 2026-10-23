import OperationForm from "../OperationForm";

export default function OperationPage({ params }: { params: { id: string } }) {
  return <OperationForm id={params.id} />;
}
