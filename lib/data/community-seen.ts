import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";

/**
 * Què li queda per mirar a la comunitat, i quan hi va entrar per últim cop.
 *
 * EL TALL
 *
 * Una data per client (`community_seen`, 0087) i prou. El marcatge és «en
 * entrar a la pantalla, tot vist», de manera que una taula de (client × ítem)
 * guardaria N files per dir el que diu una data.
 *
 * Sense fila, el tall és l'ALTA del client. Així qui s'acaba de donar d'alta no
 * es troba una piloteta amb tot l'històric del centre, i no cal sembrar res ni
 * fer cap back-fill.
 *
 * VA PER LA SESSIÓ DEL CLIENT, NO PER `service_role`
 *
 * Totes dues funcions fan servir `createClient()` i no el client d'admin. No és
 * indiferent: el que impedeix que un client mogui el marcador d'un altre és la
 * RLS de la 0087, i amb `service_role` aquella comprovació no arribaria a
 * córrer mai. Aquí la garantia la dona la base, com a l'aforament dels grups.
 */

/** Enquestes que encara es poden respondre. */
function pollIsLive(p: { active: boolean; closes_at: string | null }, today: string) {
  return p.active && (p.closes_at === null || p.closes_at >= today);
}

/**
 * Anuncis i enquestes publicats després de l'última visita del client.
 *
 * Una enquesta VISTA i NO VOTADA no compta: comptar-la fins que voti
 * convertiria la piloteta en un recordatori insistent, que és el pop-up
 * obligatori que es va descartar. Per això aquí no es mira `poll_responses`.
 */
export async function countUnreadCommunity(
  clientId: string,
  /**
   * L'alta del client, que és el tall quan encara no ha mirat mai la
   * comunitat. La hi dona qui crida perquè ja la porta de la mateixa consulta
   * amb què ha resolt el `clientId`: demanar-la aquí tornaria a llegir la fila
   * de `clients` que acaba de passar per davant.
   */
  clientCreatedAt: string,
): Promise<number> {
  const today = centerToday();

  if (USE_MOCK) {
    const store = getStore();
    const seen =
      store.community_seen.find((r) => r.client_id === clientId)?.seen_at ??
      clientCreatedAt;
    const anuncis = store.announcements.filter((a) => a.created_at > seen).length;
    const enquestes = store.polls.filter(
      (p) => p.created_at > seen && pollIsLive(p, today),
    ).length;
    return anuncis + enquestes;
  }

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("community_seen")
    .select("seen_at")
    .eq("client_id", clientId)
    .maybeSingle();
  const seen = row?.seen_at ?? clientCreatedAt;
  if (!seen) return 0;

  // `head: true` amb `count: exact`: no baixa ni una fila, només el número.
  const [anuncis, enquestes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .gt("created_at", seen),
    supabase
      .from("polls")
      .select("id", { count: "exact", head: true })
      .gt("created_at", seen)
      .eq("active", true)
      .or(`closes_at.is.null,closes_at.gte.${today}`),
  ]);

  return (anuncis.count ?? 0) + (enquestes.count ?? 0);
}

/**
 * Deixa constància que aquest client acaba de mirar la comunitat.
 *
 * És un UPSERT, i per això la 0087 té polítiques d'INSERT i d'UPDATE per
 * separat: amb només la d'alta, la primera visita funcionaria i la segona
 * fallaria en silenci —la fila ja hi seria— i la piloteta no s'apagaria mai
 * més sense que res es queixés.
 */
export async function markCommunitySeen(clientId: string): Promise<void> {
  const now = new Date().toISOString();

  if (USE_MOCK) {
    const store = getStore();
    const row = store.community_seen.find((r) => r.client_id === clientId);
    if (row) row.seen_at = now;
    else store.community_seen.push({ client_id: clientId, seen_at: now });
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("community_seen")
    .upsert({ client_id: clientId, seen_at: now }, { onConflict: "client_id" });
  if (error) throw error;
}
