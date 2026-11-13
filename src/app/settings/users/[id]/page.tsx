import UserForm from "../UserForm";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  return <UserForm id={(await params).id} />;
}
