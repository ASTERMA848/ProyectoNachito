import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { combineFilters, type ListParams } from "@/lib/list-query";

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

const wordWhere = (word: string): Where => ({
  OR: ["name", "lastname", "document", "cuitCuil", "email", "phone"].map((field) => ({ [field]: { contains: word, mode: "insensitive" } })),
});

// Cada palabra tiene que aparecer en algún campo: "Carlos Benítez" junta nombre y apellido.
const termWhere = (term: string): Where => ({ AND: term.split(/\s+/).filter(Boolean).slice(0, 6).map(wordWhere) });

export function contactsWhere(params: Pick<ListParams, "terms" | "filters">): Where {
  const and = combineFilters<Where>(params.filters, resolveFilter);
  // Los archivados no aparecen salvo que se filtren.
  if (!params.filters.some((filter) => filter.startsWith("status:"))) and.push({ isActive: true });
  if (params.terms.length) and.push({ OR: params.terms.map(termWhere) });
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
  const where = contactsWhere(params);
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
