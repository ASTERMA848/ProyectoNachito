import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { iconSize } from "@/components/ui";
import { formatAmount } from "@/lib/format-currency";
import styles from "./accounts.module.css";

export const contactName = (contact: { name: string; lastname?: string | null }) => [contact.name, contact.lastname].filter(Boolean).join(" ");

// Saldo con signo, color y flecha: rojo y flecha abajo si el contacto le debe a la agencia,
// verde y flecha arriba si la agencia le debe a él.
export function Balance({ value, code, decimals }: { value: number; code: string; decimals: number }) {
  const tone = value < 0 ? styles.negative : value > 0 ? styles.positive : styles.muted;
  const Icon = value < 0 ? ArrowDownRight : value > 0 ? ArrowUpRight : null;
  return (
    <span className={`${styles.amount} ${styles.withIcon} ${tone}`}>
      {Icon && <Icon size={iconSize.xs} aria-hidden="true" />}
      {formatAmount(value, code, decimals)}
    </span>
  );
}
