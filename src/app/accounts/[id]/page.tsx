import AccountDetail from "../AccountDetail";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  return <AccountDetail id={(await params).id} />;
}
