import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";
import { isBonoExpired } from "@/lib/data/bonos";
import { matchesName, nameWords, wordRegex } from "@/lib/client-search-match";
import type { BonoStatus, ServiceType } from "@/types/database";

/**
 * CREAR DES D'UN FORAT: A QUI I AMB QUIN BO.
 *
 * El professional crea reserves per als SEUS clients assignats: és el que
 * accepta `assertMayBookFor` en crear, i el que el selector ha d'oferir (ni un
 * de més, perquè fallaria en prémer Crear).
 *
 * El bo que es gasta no el tria qui reserva: és el MÉS ANTIC utilitzable del
 * servei (actiu o pendent de pagament, amb sessions i sense caducar), el mateix
 * criteri que fa servir el client quan reserva ell mateix. La pantalla l'ensenya
 * abans de crear; el servidor el torna a triar en crear (`pickUsableBono`), i
 * els dos surten d'aquí perquè no puguin dir coses diferents.
 */
export type BookableBono = {
  id: string;
  serviceType: ServiceType;
  remaining: number;
  total: number;
  expiresAt: string | null;
};
export type BookableClient = { id: string; name: string; bonos: BookableBono[] };

type BonoRow = {
  id: string;
  client_id: string;
  service_type: ServiceType;
  remaining_sessions: number;
  total_sessions: number;
  status: BonoStatus;
  expires_at: string | null;
  purchased_at: string;
};

/** Utilitzable i en ordre: el primer de cada servei és el que es gastaria. */
function usable(rows: BonoRow[]): BonoRow[] {
  return rows
    .filter(
      (b) =>
        (b.status === "active" || b.status === "pending_payment") &&
        b.remaining_sessions > 0 &&
        !isBonoExpired(b),
    )
    .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at));
}

const toBookable = (b: BonoRow): BookableBono => ({
  id: b.id,
  serviceType: b.service_type,
  remaining: b.remaining_sessions,
  total: b.total_sessions,
  expiresAt: b.expires_at,
});

/** Els clients assignats a aquest professional, amb els bons que poden gastar. */
export async function listBookableClients(trainerId: string): Promise<BookableClient[]> {
  if (USE_MOCK) {
    const s = getStore();
    return s.clients
      .filter((c) => c.assigned_trainer_id === trainerId)
      .map((c) => ({
        id: c.id,
        name: s.profiles.find((p) => p.id === c.profile_id)?.full_name ?? "—",
        bonos: usable(s.bonos.filter((b) => b.client_id === c.id) as BonoRow[]).map(toBookable),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id,
       profile:profiles!clients_profile_id_fkey(full_name),
       bonos(id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at)`,
    )
    .eq("assigned_trainer_id", trainerId);
  if (error) throw error;
  type Row = { id: string; profile: { full_name: string | null } | null; bonos: BonoRow[] };
  return (data as unknown as Row[])
    .map((c) => ({
      id: c.id,
      name: c.profile?.full_name ?? "—",
      bonos: usable(c.bonos).map(toBookable),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Un sol client per reservar-li, amb els bons que pot gastar: el que arriba ja
 * posat al formulari de «Nova reserva» des de la seva fitxa.
 *
 * Amb `onlyTrainerId`, només si és assignat a aquest professional, com el
 * buscador: un professional que arribi amb l'id d'un client d'un company no el
 * troba posat, i el servidor tampoc no li deixaria reservar (`assertMayBookFor`).
 */
export async function getBookableClient(
  clientId: string,
  onlyTrainerId: string | null,
): Promise<BookableClient | null> {
  if (USE_MOCK) {
    const s = getStore();
    const c = s.clients.find(
      (x) => x.id === clientId && (!onlyTrainerId || x.assigned_trainer_id === onlyTrainerId),
    );
    if (!c) return null;
    return {
      id: c.id,
      name: s.profiles.find((p) => p.id === c.profile_id)?.full_name ?? "—",
      bonos: usable(s.bonos.filter((b) => b.client_id === c.id) as BonoRow[]).map(toBookable),
    };
  }
  const supabase = await createClient();
  let q = supabase
    .from("clients")
    .select(
      `id,
       profile:profiles!clients_profile_id_fkey(full_name),
       bonos(id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at)`,
    )
    .eq("id", clientId);
  if (onlyTrainerId) q = q.eq("assigned_trainer_id", onlyTrainerId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as { id: string; profile: { full_name: string | null } | null; bonos: BonoRow[] };
  return { id: row.id, name: row.profile?.full_name ?? "—", bonos: usable(row.bonos).map(toBookable) };
}

/** El bo que es gastaria: el més antic utilitzable d'aquest servei, o cap. */
export async function pickUsableBono(
  clientId: string,
  serviceType: ServiceType,
): Promise<BookableBono | null> {
  let rows: BonoRow[];
  if (USE_MOCK) {
    rows = getStore().bonos.filter(
      (b) => b.client_id === clientId && b.service_type === serviceType,
    ) as BonoRow[];
  } else {
    const { data, error } = await createAdminClient()
      .from("bonos")
      .select("id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at")
      .eq("client_id", clientId)
      .eq("service_type", serviceType)
      .in("status", ["active", "pending_payment"])
      .gt("remaining_sessions", 0)
      .or(`expires_at.is.null,expires_at.gte.${centerToday()}`);
    if (error) throw error;
    rows = (data ?? []) as BonoRow[];
  }
  const first = usable(rows)[0];
  return first ? toBookable(first) : null;
}

/**
 * BUSCAR UN CLIENT PER RESERVAR-LI, AL SERVIDOR.
 *
 * Els selectors de client carregaven TOTS els clients del centre a la pàgina, i
 * Supabase en torna com a molt 1000 per consulta: passat aquest nombre, els
 * últims no hi sortien i ningú no ho notava. Ara la pantalla envia el que s'ha
 * escrit i en torna com a molt `CLIENT_SEARCH_LIMIT`, amb els bons que poden
 * gastar.
 *
 *   · L'admin busca entre tots els clients del centre.
 *   · El professional, NOMÉS entre els seus assignats: els únics per als quals
 *     `assertMayBookFor` li deixarà crear la reserva. No ho decideix la
 *     pantalla: qui crida passa `onlyTrainerId` segons el rol de qui mira.
 *
 * Sense text, surten els primers per ordre alfabètic.
 *
 * ELS ACCENTS
 *
 * «nuria» ha de trobar «Núria». Postgres compara les lletres tal com són, i fer
 * servir `unaccent` voldria una migració. En comptes d'això, cada paraula
 * escrita es converteix en una expressió regular que accepta les dues grafies
 * de cada lletra (`n[uùúûü]r[iìíîï][aàáâäã]`) i es filtra amb `imatch` (sense
 * majúscules). Una condició per paraula: «puig laia» troba «Laia Puig».
 */
export const CLIENT_SEARCH_LIMIT = 20;

export async function searchBookableClients(
  query: string,
  onlyTrainerId: string | null,
): Promise<BookableClient[]> {
  const q = query.trim().slice(0, 60);

  // El professional: els seus assignats, que ja és una llista acotada.
  if (onlyTrainerId) {
    return (await listBookableClients(onlyTrainerId))
      .filter((c) => !q || matchesName(c.name, q))
      .slice(0, CLIENT_SEARCH_LIMIT);
  }

  if (USE_MOCK) {
    const s = getStore();
    return s.clients
      .map((c) => ({
        id: c.id,
        name: s.profiles.find((p) => p.id === c.profile_id)?.full_name ?? "—",
        bonos: usable(s.bonos.filter((b) => b.client_id === c.id) as BonoRow[]).map(toBookable),
      }))
      .filter((c) => !q || matchesName(c.name, q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, CLIENT_SEARCH_LIMIT);
  }

  // L'admin: primer els noms (una consulta petita i ordenada), després els
  // clients d'aquests noms amb els seus bons.
  const supabase = await createClient();
  let names = supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "client")
    .order("full_name")
    .limit(CLIENT_SEARCH_LIMIT);
  for (const w of nameWords(q)) names = names.filter("full_name", "imatch", wordRegex(w));
  const { data: profiles, error: pErr } = await names;
  if (pErr) throw pErr;
  const picked = profiles ?? [];
  if (picked.length === 0) return [];

  const { data, error } = await supabase
    .from("clients")
    .select(
      `id, profile_id,
       bonos(id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at)`,
    )
    .in(
      "profile_id",
      picked.map((p) => p.id),
    );
  if (error) throw error;
  type Row = { id: string; profile_id: string; bonos: BonoRow[] };
  const byProfile = new Map((data as unknown as Row[]).map((c) => [c.profile_id, c]));
  return picked.flatMap((p) => {
    const c = byProfile.get(p.id);
    return c ? [{ id: c.id, name: p.full_name ?? "—", bonos: usable(c.bonos).map(toBookable) }] : [];
  });
}
