import OperationForm from "../OperationForm";

export default async function OperationPage({ params }: { params: Promise<{ id: string }> }) {
  return <OperationForm id={(await params).id} />;
}
