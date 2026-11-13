import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { combineFilters, type ListParams } from "@/lib/list-query";
import { CONTACT_COLUMNS, contactIdsMatching, textConditions, type ContactColumn } from "@/lib/search";

type Where = Prisma.ContactWhereInput;

export const SORT_KEYS = ["name", "created"] as const;
export const GROUP_KEYS = ["role"] as const;

// Combinación de roles de un contacto: clave de grupo y su etiqueta.
const ROLE_GROUPS: Record<string, { label: string; where: Where }> = {
  client_only: { label: "Clientes", where: { isClient: true, isProvider: false } },
  provider_only: { label: "Proveedores", where: { isClient: false, isProvider: true } },
  both: { label: "Clientes y proveedores", where: { isClient: true, isProvider: true } },
  none: { label: "Sin rol", where: { isClient: false, isProvider: false } },
};
const roleKey = (isClient: boolean, isProvider: boolean) => (isClient && isProvider ? "both" : isClient ? "client_only" : isProvider ? "provider_only" : "none");

function resolveFilter(group: string, value: string): Where | null {
  switch (group) {
    case "role":
      if (value === "client") return { isClient: true };
      if (value === "provider") return { isProvider: true };
      return null;
    case "status":
      if (value === "archived") return { isActive: false };
      if (value === "active") return { isActive: true };
      return null;
    case "tag":
      return { tags: { some: { tagId: value } } };
    // Clave exacta de una fila de grupo.
    case "roleGroup":
      return ROLE_GROUPS[value]?.where ?? null;
    default:
      return null;
  }
}

// Campos por los que se puede buscar puntualmente (qf=document:20123456).
const SEARCH_BY: Record<string, readonly ContactColumn[]> = {
  name: ["name", "lastname"],
  document: ["document", "cuitCuil"],
  email: ["email"],
  phone: ["phone"],
};
export const SEARCH_FIELDS = Object.keys(SEARCH_BY);

const matching = (columns: readonly ContactColumn[]) => async (word: string): Promise<Where> => ({ id: { in: await contactIdsMatching(word, columns) } });

export async function contactsWhere(params: Pick<ListParams, "terms" | "filters" | "fieldTerms">): Promise<Where> {
  const and = combineFilters<Where>(params.filters, resolveFilter);
  // Los archivados no aparecen salvo que se filtren.
  if (!params.filters.some((filter) => filter.startsWith("status:"))) and.push({ isActive: true });
  and.push(...(await textConditions<Where>(params, matching(CONTACT_COLUMNS), Object.fromEntries(Object.entries(SEARCH_BY).map(([field, columns]) => [field, matching(columns)])))));
  return { deletedAt: null, AND: and };
}

const ORDER: Record<string, (dir: "asc" | "desc") => Prisma.ContactOrderByWithRelationInput[]> = {
  name: (dir) => [{ name: dir }, { lastname: dir }],
  created: (dir) => [{ createdAt: dir }],
};

export const contactInclude = {
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
} satisfies Prisma.ContactInclude;

export async function listContacts(params: ListParams) {
  const where = await contactsWhere(params);
  const sort = params.sort ?? { key: "name", dir: "asc" as const };
  const [contacts, total, roles] = await Promise.all([
    prisma.contact.findMany({ where, include: contactInclude, orderBy: [...ORDER[sort.key](sort.dir), { id: "asc" }], skip: params.offset, take: params.limit }),
    prisma.contact.count({ where }),
    params.groupBy === "role" ? prisma.contact.groupBy({ by: ["isClient", "isProvider"], where, _count: { _all: true } }) : null,
  ]);
  const groups = roles
    ?.map((row) => {
      const key = roleKey(row.isClient, row.isProvider);
      return { key, filter: `roleGroup:${key}`, label: ROLE_GROUPS[key].label, count: row._count._all };
    })
    .sort((a, b) => Object.keys(ROLE_GROUPS).indexOf(a.key) - Object.keys(ROLE_GROUPS).indexOf(b.key));
  return { contacts, total, offset: params.offset, limit: params.limit, groups: groups ?? null };
}

export type ContactListResult = Awaited<ReturnType<typeof listContacts>>;
export type ContactListItem = ContactListResult["contacts"][number];

// Contactos activos que ya tienen este documento, CUIT/CUIL o email. Es un aviso, no un bloqueo:
// la agencia puede tener motivos (CUIT compartido entre socios, un email de uso común, etc.).
export async function findDuplicateContacts(input: { document?: string | null; cuitCuil?: string | null; email?: string | null; excludeId?: string }) {
  const or: Where[] = [];
  if (input.document?.trim()) or.push({ document: input.document.trim() });
  if (input.cuitCuil?.trim()) or.push({ cuitCuil: input.cuitCuil.trim() });
  if (input.email?.trim()) or.push({ email: { equals: input.email.trim(), mode: "insensitive" } });
  if (!or.length) return [];
  return prisma.contact.findMany({
    where: { deletedAt: null, isActive: true, OR: or, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) },
    select: { id: true, name: true, lastname: true, document: true, cuitCuil: true, email: true },
    take: 5,
  });
}
