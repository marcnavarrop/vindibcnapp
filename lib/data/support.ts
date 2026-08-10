import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import type { SupportCategory, SupportStatus } from "@/types/database";

export type SupportTicket = {
  id: string;
  createdBy: string;
  authorName: string;
  title: string;
  description: string;
  category: SupportCategory;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
};

const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;

export type TicketInput = {
  title: string;
  description: string;
  category: SupportCategory;
};

/** Neteja i valida el que arriba del formulari. Mateixos límits que la taula. */
export function validateTicket(
  input: TicketInput,
): { ok: true; value: TicketInput } | { ok: false; error: string } {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) return { ok: false, error: "Cal un títol." };
  if (title.length > MAX_TITLE)
    return { ok: false, error: `El títol no pot passar de ${MAX_TITLE} caràcters.` };
  if (!description) return { ok: false, error: "Cal una descripció." };
  if (description.length > MAX_DESCRIPTION)
    return {
      ok: false,
      error: `La descripció no pot passar de ${MAX_DESCRIPTION} caràcters.`,
    };
  return { ok: true, value: { title, description, category: input.category } };
}

/**
 * Tiquets visibles per a qui mira.
 *
 * No filtra per rol aquí: se'n cuida la RLS (l'admin els veu tots, el
 * professional només els seus). Es fa servir el client de SESSIÓ i no el de
 * servei precisament perquè aquesta política s'apliqui de veritat, en comptes
 * de dependre que cada pantalla es recordi de filtrar.
 */
export async function listSupportTickets(): Promise<SupportTicket[]> {
  if (USE_MOCK) {
    const store = getStore();
    const { getViewer } = await import("@/lib/auth");
    const viewer = await getViewer();
    const nameOf = (id: string) =>
      store.profiles.find((p) => p.id === id)?.full_name ?? "—";
    return store.support_tickets
      .filter(
        (t) => viewer?.role === "admin" || t.created_by === (viewer?.id ?? ""),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((t) => ({
        id: t.id,
        createdBy: t.created_by,
        authorName: nameOf(t.created_by),
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id, created_by, title, description, category, status, created_at, updated_at, author:profiles!support_tickets_created_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    created_by: string;
    title: string;
    description: string;
    category: SupportCategory;
    status: SupportStatus;
    created_at: string;
    updated_at: string;
    author: { full_name: string | null } | null;
  };
  return (data as unknown as Row[]).map((t) => ({
    id: t.id,
    createdBy: t.created_by,
    authorName: t.author?.full_name ?? "—",
    title: t.title,
    description: t.description,
    category: t.category,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

/**
 * Crea un tiquet a nom de qui el reporta.
 *
 * `created_by` el posa el servidor a partir de la sessió, mai el formulari:
 * el client no ha de poder dir de qui és un tiquet. La RLS ho torna a
 * comprovar (`created_by = auth.uid()`), que és el que protegeix l'API.
 */
export async function createSupportTicket(
  authorId: string,
  input: TicketInput,
): Promise<SupportTicket> {
  const checked = validateTicket(input);
  if (!checked.ok) throw new Error(checked.error);
  const { title, description, category } = checked.value;

  if (USE_MOCK) {
    const store = getStore();
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      created_by: authorId,
      title,
      description,
      category,
      status: "open" as SupportStatus,
      created_at: now,
      updated_at: now,
    };
    store.support_tickets.push(row);
    saveStore(store);
    const name =
      store.profiles.find((p) => p.id === authorId)?.full_name ?? "—";
    return {
      id: row.id,
      createdBy: authorId,
      authorName: name,
      title,
      description,
      category,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({ created_by: authorId, title, description, category })
    .select(
      "id, created_by, title, description, category, status, created_at, updated_at, author:profiles!support_tickets_created_by_fkey(full_name)",
    )
    .single();
  if (error) throw error;

  const row = data as unknown as {
    id: string;
    created_at: string;
    updated_at: string;
    author: { full_name: string | null } | null;
  };
  return {
    id: row.id,
    createdBy: authorId,
    authorName: row.author?.full_name ?? "—",
    title,
    description,
    category,
    status: "open",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Canvia l'estat. Només l'admin: ho imposa la RLS, no aquesta funció. */
export async function setSupportTicketStatus(
  id: string,
  status: SupportStatus,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const t = store.support_tickets.find((x) => x.id === id);
    if (!t) throw new Error("Tiquet no trobat.");
    t.status = status;
    t.updated_at = new Date().toISOString();
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("support_tickets")
    .update({ status }, { count: "exact" })
    .eq("id", id);
  if (error) throw error;
  // La RLS no dona error quan no deixa: simplement no toca cap fila. Sense
  // aquesta comprovació, un professional intentant tancar un tiquet veuria un
  // "fet!" que no ha passat.
  if (count === 0) throw new Error("No tens permís per canviar aquest tiquet.");
}
