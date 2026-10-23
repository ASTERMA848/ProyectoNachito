import AccountDetail from "../AccountDetail";

export default function AccountPage({ params }: { params: { id: string } }) {
  return <AccountDetail id={params.id} />;
}
