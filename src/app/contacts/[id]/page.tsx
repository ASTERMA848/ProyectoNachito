import ContactForm from "../ContactForm";

export default function ContactPage({ params }: { params: { id: string } }) {
  return <ContactForm id={params.id} />;
}
