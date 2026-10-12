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
  /** La resposta de l'admin (0106), o null si encara no n'hi ha. */
  answer: string | null;
  answeredAt: string | null;
  answeredByName: string | null;
};

const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
/** El mateix límit que la descripció i que la constraint de la 0106. */
export const MAX_ANSWER = 5000;

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
        answer: t.answer ?? null,
        answeredAt: t.answered_at ?? null,
        answeredByName: t.answered_by ? nameOf(t.answered_by) : null,
      }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id, created_by, title, description, category, status, created_at, updated_at, answer, answered_at, author:profiles!support_tickets_created_by_fkey(full_name), answerer:profiles!support_tickets_answered_by_fkey(full_name)",
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
    answer: string | null;
    answered_at: string | null;
    author: { full_name: string | null } | null;
    answerer: { full_name: string | null } | null;
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
    answer: t.answer,
    answeredAt: t.answered_at,
    answeredByName: t.answer ? (t.answerer?.full_name ?? null) : null,
  }));
}

/**
 * Els darrers tiquets OBERTS PER UN MATEIX.
 *
 * Sempre els propis, també per a l'admin: el panell ràpid és accés ràpid al
 * que has reportat tu. La vista de gestió de tot l'equip segueix sent la
 * pàgina completa, que és on l'admin hi treballa.
 */
export async function listMyRecentTickets(
  profileId: string,
  limit = 5,
): Promise<SupportTicket[]> {
  const all = await listSupportTickets();
  return all.filter((t) => t.createdBy === profileId).slice(0, limit);
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
      answer: null,
      answered_at: null,
      answered_by: null,
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
      answer: null,
      answeredAt: null,
      answeredByName: null,
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
    answer: null,
    answeredAt: null,
    answeredByName: null,
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

/** Neteja i valida una resposta. Mateix límit que la constraint de la 0106. */
export function validateAnswer(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Escriu la resposta." };
  if (value.length > MAX_ANSWER)
    return { ok: false, error: `La resposta no pot passar de ${MAX_ANSWER} caràcters.` };
  return { ok: true, value };
}

/** El que cal per avisar qui va obrir el tiquet que ja té resposta. */
export type AnsweredTicket = {
  id: string;
  createdBy: string;
  title: string;
  status: SupportStatus;
  /** La resposta d'abans: si és la mateixa, no es torna a avisar. */
  previousAnswer: string | null;
};

/**
 * Desa la resposta d'un tiquet i, en el mateix UPDATE, el nou estat.
 *
 * Una sola escriptura a posta: «Respondre i marcar resolt» no pot quedar a
 * mitges (la resposta desada i el tiquet obert, o al revés). Només l'admin: ho
 * imposa la RLS (`support_tickets_admin_update`, 0047), i com a
 * `setSupportTicketStatus`, cap fila tocada vol dir que no l'ha deixat.
 *
 * Torna la resposta d'ABANS perquè qui crida decideixi si cal avisar: corregir
 * només l'estat amb el mateix text no ha de tornar a enviar el correu.
 */
export async function answerSupportTicket(
  id: string,
  input: { answer: string; status: SupportStatus; answeredBy: string },
): Promise<AnsweredTicket> {
  const checked = validateAnswer(input.answer);
  if (!checked.ok) throw new Error(checked.error);
  const answer = checked.value;
  const now = new Date().toISOString();

  if (USE_MOCK) {
    const store = getStore();
    const t = store.support_tickets.find((x) => x.id === id);
    if (!t) throw new Error("Tiquet no trobat.");
    const previousAnswer = t.answer ?? null;
    t.answer = answer;
    t.answered_at = now;
    t.answered_by = input.answeredBy;
    t.status = input.status;
    t.updated_at = now;
    saveStore(store);
    return { id, createdBy: t.created_by, title: t.title, status: input.status, previousAnswer };
  }

  const supabase = await createClient();
  // La resposta d'abans es llegeix amb la sessió: si la RLS no deixa veure el
  // tiquet, tampoc el deixarà tocar, i l'error és el mateix.
  const { data: before, error: rErr } = await supabase
    .from("support_tickets")
    .select("id, created_by, title, answer")
    .eq("id", id)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!before) throw new Error("Tiquet no trobat.");

  const { error, count } = await supabase
    .from("support_tickets")
    .update(
      { answer, answered_at: now, answered_by: input.answeredBy, status: input.status },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) throw error;
  if (count === 0) throw new Error("No tens permís per respondre aquest tiquet.");

  return {
    id,
    createdBy: before.created_by,
    title: before.title,
    status: input.status,
    previousAnswer: before.answer,
  };
}

/**
 * Quants tiquets hi ha OBERTS, per a la piloteta de l'accés ràpid.
 *
 * Compta només `open`, no `open + in_progress`, encara que la safata de
 * l'admin s'obri filtrada per totes dues. Són dues preguntes diferents: la
 * piloteta avisa del que encara no ha mirat ningú —és el que justifica
 * interrompre—, i la pantalla mostra tot el que queda per tancar. Si comptés
 * també les que ja s'estan resolent, el botó duria un número permanent que
 * s'aprendria a ignorar.
 *
 * Va per compte del servidor i no comptant la llista: en real és un `head`
 * sense files, i així la piloteta no arrossega les descripcions senceres de
 * tots els tiquets per ensenyar un número.
 */
export async function countOpenSupportTickets(): Promise<number> {
  if (USE_MOCK) {
    const store = getStore();
    const { getViewer } = await import("@/lib/auth");
    const viewer = await getViewer();
    return store.support_tickets.filter(
      (t) =>
        t.status === "open" &&
        (viewer?.role === "admin" || t.created_by === (viewer?.id ?? "")),
    ).length;
  }

  const supabase = await createClient();
  // Client de SESSIÓ: la RLS és qui decideix què entra al compte, igual que al
  // llistat. Amb el de servei, un professional veuria el comptador de tothom.
  const { count, error } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) throw error;
  return count ?? 0;
}
