// Zona horaria de la agencia. Decide qué es "hoy" o "este mes" y cómo se agrupan las fechas.
export const AGENCY_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type DateParts = { year: number; month: number; day: number };

// Fecha del calendario local de la agencia en un instante dado.
export function agencyToday(at = new Date()): DateParts {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENCY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .split("-")
    .map(Number);
  return { year, month, day };
}

// Las fechas de operación se guardan como medianoche UTC del día elegido (la fecha sin hora).
// Por eso los rangos se arman en UTC, a partir del día local de la agencia.
const utcMidnight = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

export type DatePreset = "today" | "this_month" | "last_month" | "this_year";

export function dateOnlyRange(preset: DatePreset, at = new Date()) {
  const { year, month, day } = agencyToday(at);
  switch (preset) {
    case "today":
      return { gte: utcMidnight(year, month, day), lt: utcMidnight(year, month, day + 1) };
    case "this_month":
      return { gte: utcMidnight(year, month, 1), lt: utcMidnight(year, month + 1, 1) };
    case "last_month":
      return { gte: utcMidnight(year, month - 1, 1), lt: utcMidnight(year, month, 1) };
    case "this_year":
      return { gte: utcMidnight(year, 1, 1), lt: utcMidnight(year + 1, 1, 1) };
  }
}

// "2026-10" -> rango del mes completo; null si el texto no es un mes válido.
export function monthRange(key: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return { gte: utcMidnight(year, month, 1), lt: utcMidnight(year, month + 1, 1) };
}

export const monthKey = (date: Date) => date.toISOString().slice(0, 7);

export function monthLabel(key: string) {
  const range = monthRange(key);
  if (!range) return key;
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(range.gte);
}

// Fecha de calendario (sin hora) en formato local, para fechas guardadas como medianoche UTC.
export function formatDateOnly(value: string | Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

// Instantes reales (createdAt): se muestran en la hora local de la agencia.
export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: AGENCY_TIME_ZONE }).format(new Date(value));
}

export function dayKey(value: string | Date) {
  const { year, month, day } = agencyToday(new Date(value));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// "Hoy", "Ayer" o la fecha larga, según el día local de la agencia.
export function dayLabel(key: string, now = new Date()) {
  const today = agencyToday(now);
  const todayKey = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  const yesterday = agencyToday(new Date(now.getTime() - 86_400_000));
  const yesterdayKey = `${yesterday.year}-${String(yesterday.month).padStart(2, "0")}-${String(yesterday.day).padStart(2, "0")}`;
  if (key === todayKey) return "Hoy";
  if (key === yesterdayKey) return "Ayer";
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(utcMidnight(year, month, day));
}
