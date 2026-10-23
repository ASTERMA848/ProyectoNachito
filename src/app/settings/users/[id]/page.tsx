import UserForm from "../UserForm";

export default function UserPage({ params }: { params: { id: string } }) {
  return <UserForm id={params.id} />;
}
