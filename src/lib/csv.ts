// Exportación CSV para Excel en español: separador ";" y BOM para que respete los acentos.

// Una celda que empieza con = + - @ se abriría como fórmula: se le antepone un apóstrofo,
// salvo que sea un número (los importes negativos tienen que seguir siendo números).
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?[\d.,]+$/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(";")).join("\r\n");

export function downloadCsv(fileName: string, rows: unknown[][]) {
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revocarla en el mismo momento puede cancelar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
