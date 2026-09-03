import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";

/**
 * Etiquetes de client: catàleg de text lliure i qui les té.
 *
 * Qui pot fer què ho decideix la RLS de la 0068, no aquest fitxer: el catàleg
 * només l'escriu l'admin; les assignacions, l'admin i l'entrenador/a assignat.
 * Per això les escriptures van amb el client de la SESSIÓ i no amb
 * `service_role` —si anessin per service_role, la policy no s'avaluaria mai i
 * el permís se'l guardaria el codi, que és justament on es perd.
 *
 * L'excepció és `listTagIdsForClient`, que sí que va per service_role. Ho
 * explica allà.
 */

export type ClientTag = {
  id: string;
  name: string;
  createdAt: string;
};

/** Etiqueta del catàleg amb quants clients la porten. Per a la pantalla d'admin. */
export type ClientTagWithUsage = ClientTag & {
  clientCount: number;
  /** Ofertes que la fan servir com a destinatària. Bloquegen l'esborrat (FK restrict). */
  promotionNames: string[];
};

function rowToTag(r: { id: string; name: string; created_at: string }): ClientTag {
  return { id: r.id, name: r.name, createdAt: r.created_at };
}

const byName = (a: ClientTag, b: ClientTag) =>
  a.name.localeCompare(b.name, "ca", { sensitivity: "base" });

// ─── Catàleg ────────────────────────────────────────────────────────────────

export async function listClientTags(): Promise<ClientTag[]> {
  if (USE_MOCK) {
    return getStore().client_tags.map(rowToTag).sort(byName);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_tags").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToTag).sort(byName);
}

/**
 * El catàleg amb el que fa falta per gestionar-lo: quants clients té cada
 * etiqueta i quines ofertes hi apunten.
 *
 * Les ofertes es llegeixen perquè la FK és `on delete restrict` (0069): sense
 * aquesta informació, esborrar una etiqueta en ús donaria un 23503 cru i
 * l'admin no sabria per què. Millor dir-l'hi abans.
 */
export async function listClientTagsWithUsage(): Promise<ClientTagWithUsage[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.client_tags
      .map(rowToTag)
      .sort(byName)
      .map((t) => ({
        ...t,
        clientCount: store.client_tag_assignments.filter((a) => a.tag_id === t.id)
          .length,
        promotionNames: store.promotions
          .filter((p) => p.audience_tag_id === t.id)
          .map((p) => p.name),
      }));
  }

  const supabase = await createClient();
  const [tags, assignments, promos] = await Promise.all([
    supabase.from("client_tags").select("*"),
    supabase.from("client_tag_assignments").select("tag_id"),
    supabase.from("promotions").select("name, audience_tag_id").not("audience_tag_id", "is", null),
  ]);
  if (tags.error) throw tags.error;
  if (assignments.error) throw assignments.error;
  if (promos.error) throw promos.error;

  const counts = new Map<string, number>();
  for (const a of assignments.data ?? [])
    counts.set(a.tag_id, (counts.get(a.tag_id) ?? 0) + 1);

  const names = new Map<string, string[]>();
  for (const p of promos.data ?? []) {
    if (!p.audience_tag_id) continue;
    names.set(p.audience_tag_id, [...(names.get(p.audience_tag_id) ?? []), p.name]);
  }

  return (tags.data ?? [])
    .map(rowToTag)
    .sort(byName)
    .map((t) => ({
      ...t,
      clientCount: counts.get(t.id) ?? 0,
      promotionNames: names.get(t.id) ?? [],
    }));
}

/**
 * Crea una etiqueta i en torna l'id. Si ja existeix una amb el mateix nom
 * (sense distingir majúscules ni espais), torna la que hi havia en comptes de
 * petar: qui escriu "vip" a la fitxa d'un client vol assignar la VIP que ja hi
 * ha, no crear-ne una segona.
 */
export async function createClientTag(name: string): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error("El nom de l'etiqueta no pot ser buit.");
  if (clean.length > 40) throw new Error("El nom de l'etiqueta és massa llarg (màxim 40).");

  const same = (a: string) => a.trim().toLowerCase() === clean.toLowerCase();

  if (USE_MOCK) {
    const store = getStore();
    const existing = store.client_tags.find((t) => same(t.name));
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    store.client_tags.push({ id, name: clean, created_at: new Date().toISOString() });
    saveStore(store);
    return id;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_tags")
    .insert({ name: clean })
    .select("id")
    .single();

  // 23505 = l'índex únic de la 0068. Ja hi era: la busquem i la tornem.
  if (error?.code === "23505") {
    const { data: found } = await supabase.from("client_tags").select("id, name");
    const hit = (found ?? []).find((t) => same(t.name));
    if (hit) return hit.id;
  }
  if (error || !data) {
    console.error("[createClientTag] Supabase error:", error);
    throw new Error(error?.message ?? "No s'ha pogut crear l'etiqueta.");
  }
  return data.id;
}

export async function renameClientTag(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("El nom de l'etiqueta no pot ser buit.");
  if (clean.length > 40) throw new Error("El nom de l'etiqueta és massa llarg (màxim 40).");

  if (USE_MOCK) {
    const store = getStore();
    const t = store.client_tags.find((x) => x.id === id);
    if (!t) throw new Error("Etiqueta no trobada.");
    t.name = clean;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("client_tags").update({ name: clean }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Ja hi ha una etiqueta amb aquest nom.");
    throw new Error(error.message ?? "No s'ha pogut reanomenar l'etiqueta.");
  }
}

/**
 * Esborra una etiqueta del catàleg. Les assignacions cauen soles (cascade); una
 * oferta que hi apunti ho impedeix (restrict), i el missatge ho diu.
 */
export async function deleteClientTag(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    if (store.promotions.some((p) => p.audience_tag_id === id))
      throw new Error(
        "Aquesta etiqueta la fa servir alguna oferta. Canvia-la a l'oferta abans d'esborrar-la.",
      );
    store.client_tags = store.client_tags.filter((t) => t.id !== id);
    store.client_tag_assignments = store.client_tag_assignments.filter(
      (a) => a.tag_id !== id,
    );
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("client_tags").delete().eq("id", id);
  if (error) {
    // 23503 = la FK restrict de promotions.audience_tag_id (0069).
    if (error.code === "23503")
      throw new Error(
        "Aquesta etiqueta la fa servir alguna oferta. Canvia-la a l'oferta abans d'esborrar-la.",
      );
    throw new Error(error.message ?? "No s'ha pogut esborrar l'etiqueta.");
  }
}

// ─── Assignacions ───────────────────────────────────────────────────────────

/** Etiquetes d'un client, per a la seva fitxa. Va amb la sessió: la RLS decideix. */
export async function listTagsOfClient(clientId: string): Promise<ClientTag[]> {
  if (USE_MOCK) {
    const store = getStore();
    const ids = new Set(
      store.client_tag_assignments.filter((a) => a.client_id === clientId).map((a) => a.tag_id),
    );
    return store.client_tags.filter((t) => ids.has(t.id)).map(rowToTag).sort(byName);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_tag_assignments")
    .select("tag:client_tags!client_tag_assignments_tag_id_fkey(id, name, created_at)")
    .eq("client_id", clientId);
  if (error) throw error;

  type Row = { tag: { id: string; name: string; created_at: string } | null };
  return (data as unknown as Row[])
    .map((r) => r.tag)
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .map(rowToTag)
    .sort(byName);
}

/**
 * NOMÉS els ids, i per `service_role`.
 *
 * És l'única funció d'aquest fitxer que se salta la RLS, i a posta. La fa
 * servir el càlcul de preus (`getClientAudience`), que corre a
 * /client/bonos amb la sessió d'un CLIENT —i un client no té permís de lectura
 * sobre les seves etiquetes, per disseny (0068): sabria com el classifica el
 * centre. Tornant ids i prou, el que en surt no diu res: un uuid no és un nom.
 */
export async function listTagIdsForClient(clientId: string): Promise<string[]> {
  if (USE_MOCK) {
    return getStore()
      .client_tag_assignments.filter((a) => a.client_id === clientId)
      .map((a) => a.tag_id);
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_tag_assignments")
    .select("tag_id")
    .eq("client_id", clientId);
  if (error) throw error;
  return (data ?? []).map((r) => r.tag_id);
}

/** Assigna una etiqueta a un client. Idempotent: repetir-ho no és un error. */
export async function assignTag(input: {
  clientId: string;
  tagId: string;
  assignedBy: string;
}): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const already = store.client_tag_assignments.some(
      (a) => a.client_id === input.clientId && a.tag_id === input.tagId,
    );
    if (already) return;
    store.client_tag_assignments.push({
      client_id: input.clientId,
      tag_id: input.tagId,
      assigned_by: input.assignedBy,
      assigned_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("client_tag_assignments").insert({
    client_id: input.clientId,
    tag_id: input.tagId,
    assigned_by: input.assignedBy,
  });
  // 23505 = ja la tenia. Tornar a marcar una casella ja marcada no és un error.
  if (error && error.code !== "23505") throw error;
}

export async function unassignTag(clientId: string, tagId: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.client_tag_assignments = store.client_tag_assignments.filter(
      (a) => !(a.client_id === clientId && a.tag_id === tagId),
    );
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_tag_assignments")
    .delete()
    .eq("client_id", clientId)
    .eq("tag_id", tagId);
  if (error) throw error;
}
