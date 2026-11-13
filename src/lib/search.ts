import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// Búsqueda de texto sin mayúsculas ni tildes: "benitez" encuentra a "Benítez".
// translate() es de PostgreSQL y no necesita la extensión unaccent, así que anda igual en local y en Neon.

const ACCENTED = "áàäâãéèëêíìïîóòöôõúùüûñç";
const PLAIN = "aaaaaeeeeiiiiooooouuuunc";

// Lo mismo en JavaScript, para comparar del lado de la interfaz.
export const foldText = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Palabras de una búsqueda: cada una tiene que aparecer en algún campo ("Carlos Benítez" junta nombre y apellido).
export const searchWords = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 6);

const likePattern = (word: string) => `%${foldText(word).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

export const CONTACT_COLUMNS = ["name", "lastname", "document", "cuitCuil", "email", "phone"] as const;
export type ContactColumn = (typeof CONTACT_COLUMNS)[number];

// Ids de los contactos (sin borrar) en los que alguno de esos campos contiene la palabra.
export async function contactIdsMatching(word: string, columns: readonly ContactColumn[]): Promise<string[]> {
  const pattern = likePattern(word);
  // Los nombres de columna salen de una lista fija: no hay texto del usuario en el SQL fuera del parámetro.
  const conditions = columns.map((column) => Prisma.sql`translate(lower(coalesce(${Prisma.raw(`"${column}"`)}, '')), ${ACCENTED}, ${PLAIN}) LIKE ${pattern}`);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Contact"
    WHERE "deletedAt" IS NULL AND (${Prisma.join(conditions, " OR ")})
    LIMIT 5000`;
  return rows.map((row) => row.id);
}

// Número de operación: sin tildes que plegar, alcanza con ignorar mayúsculas.
export const numberContains = (word: string) => ({ contains: word, mode: "insensitive" as const });

type WordWhere<W> = (word: string) => Promise<W>;

// Condiciones de búsqueda de una lista: los términos libres (q) se combinan con O entre sí y cada uno pide
// todas sus palabras en algún campo; cada búsqueda por campo (qf) se suma con Y.
export async function textConditions<W extends object>(
  params: { terms: string[]; fieldTerms: { field: string; text: string }[] },
  anyField: WordWhere<W>,
  byField: Record<string, WordWhere<W>>,
): Promise<W[]> {
  const allWords = async (text: string, where: WordWhere<W>) => ({ AND: await Promise.all(searchWords(text).map(where)) }) as unknown as W;
  const conditions: W[] = [];
  if (params.terms.length) conditions.push({ OR: await Promise.all(params.terms.map((term) => allWords(term, anyField))) } as unknown as W);
  for (const { field, text } of params.fieldTerms) conditions.push(await allWords(text, byField[field]));
  return conditions;
}
