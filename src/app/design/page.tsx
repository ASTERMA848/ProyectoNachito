import { notFound } from "next/navigation";
import DesignGallery from "./DesignGallery";

export const metadata = { title: "Sistema de diseño" };

// Galería de componentes para desarrollo: en producción no existe.
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
