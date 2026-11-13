import ContactForm from "../ContactForm";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return <ContactForm id={(await params).id} />;
}
