// Interpreta importes escritos con coma o con punto decimal ("1.500,50", "1500.50", "1500,5").
// Con coma, la coma es el decimal y los puntos son miles. Sin coma, un único punto es decimal
// salvo que lo sigan exactamente tres cifras ("1.500" son mil quinientos).
export function parseLocaleNumber(input: string | number | null | undefined): number {
  if (typeof input === "number") return input;
  const text = String(input ?? "").trim().replace(/\s/g, "");
  if (!text) return NaN;
  let normalized: string;
  if (text.includes(",")) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = text.split(".").length - 1;
    const decimals = text.split(".")[1] ?? "";
    normalized = dots === 1 && decimals.length !== 3 ? text : text.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}
