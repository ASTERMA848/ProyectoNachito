import { formatAmount } from "@/lib/format-currency";
import styles from "./accounts.module.css";

export const contactName = (contact: { name: string; lastname?: string | null }) => [contact.name, contact.lastname].filter(Boolean).join(" ");

// Saldo con signo y color: rojo si el contacto le debe a la agencia, verde si la agencia le debe a él.
export function Balance({ value, code, decimals }: { value: number; code: string; decimals: number }) {
  const tone = value < 0 ? styles.negative : value > 0 ? styles.positive : styles.muted;
  return <span className={`${styles.amount} ${tone}`}>{formatAmount(value, code, decimals)}</span>;
}
