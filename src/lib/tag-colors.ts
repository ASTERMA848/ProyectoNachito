import type { TagColor } from "@/components/ui";

// Color guardado para cada tono de la paleta de etiquetas: la base guarda un hexadecimal
// y la interfaz lo lleva al tono más cercano con tagColorFromHex.
export const TAG_COLOR_VALUES: Record<TagColor, string> = {
  gray: "#6b7280",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
};

export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  gray: "Gris",
  red: "Rojo",
  orange: "Naranja",
  yellow: "Amarillo",
  green: "Verde",
  teal: "Turquesa",
  blue: "Azul",
  indigo: "Índigo",
  purple: "Violeta",
  pink: "Rosa",
};
