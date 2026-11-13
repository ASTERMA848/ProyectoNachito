import TreasuryBox from "../TreasuryBox";

export default async function TreasuryBoxPage({ params }: { params: Promise<{ id: string }> }) {
  return <TreasuryBox id={(await params).id} />;
}
