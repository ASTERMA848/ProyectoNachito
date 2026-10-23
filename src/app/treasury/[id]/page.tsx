import TreasuryBox from "../TreasuryBox";

export default function TreasuryBoxPage({ params }: { params: { id: string } }) {
  return <TreasuryBox id={params.id} />;
}
