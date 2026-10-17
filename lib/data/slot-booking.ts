import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";
import { isBonoExpired } from "@/lib/data/bonos";
import { matchesName, nameWords, wordRegex } from "@/lib/client-search-match";
import { servicesForOthersClients } from "@/lib/booking-scope";
import { demoCompatible, type DemoWorld } from "@/lib/demo-accounts";
import { getDemoWorld } from "@/lib/data/demo-world";
import type { BonoStatus, ServiceType, Specialty } from "@/types/database";

/**
 * CREAR DES D'UN FORAT: A QUI I AMB QUIN BO.
 *
 * El professional pot reservar a qualsevol client real (0107), però no
 * qualsevol cosa: als que no són seus, només grup o la seva especialitat i
 * sempre amb bo (`staffBookingScope`, `lib/booking-scope.ts`). Aquí aquests
 * clients surten amb `restricted` i NOMÉS amb els bons que podria gastar-hi:
 * el selector no ofereix res que el servidor rebutjaria en prémer Crear.
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
export type BookableClient = {
  id: string;
  name: string;
  bonos: BookableBono[];
  /**
   * No és client de qui reserva (un professional): només bons de grup o de la
   * seva especialitat, i sense cortesia. Per a l'admin, sempre `false`.
   */
  restricted: boolean;
};

/** Qui reserva, si és un professional: per decidir què se li ofereix. */
export type BookingTrainer = { id: string; specialty: Specialty | null };

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

/**
 * El client tal com el veu qui reserva. Per a un professional, `null` si és
 * d'un altre món (demo amb demo); si no és seu, només els bons que hi pot fer
 * servir.
 */
function shape(
  c: { id: string; name: string; assignedTrainerId: string | null; bonos: BonoRow[] },
  trainer: BookingTrainer | null,
  world: DemoWorld,
): BookableClient | null {
  const bonos = usable(c.bonos);
  if (!trainer) return { id: c.id, name: c.name, bonos: bonos.map(toBookable), restricted: false };
  if (!demoCompatible(world, c.id, trainer.id)) return null;
  if (c.assignedTrainerId === trainer.id)
    return { id: c.id, name: c.name, bonos: bonos.map(toBookable), restricted: false };
  const allowed = servicesForOthersClients(trainer.specialty);
  return {
    id: c.id,
    name: c.name,
    bonos: bonos.filter((b) => allowed.includes(b.service_type)).map(toBookable),
    restricted: true,
  };
}

/**
 * Un sol client per reservar-li, amb els bons que pot gastar: el que arriba ja
 * posat al formulari de «Nova reserva» des de la seva fitxa.
 *
 * Amb `trainer`, com el veu aquell professional (`shape`): un client demo per a
 * un professional real no hi surt, i el d'un company surt `restricted`.
 */
export async function getBookableClient(
  clientId: string,
  trainer: BookingTrainer | null,
): Promise<BookableClient | null> {
  const world = await getDemoWorld();
  if (USE_MOCK) {
    const s = getStore();
    const c = s.clients.find((x) => x.id === clientId);
    if (!c) return null;
    return shape(
      {
        id: c.id,
        name: s.profiles.find((p) => p.id === c.profile_id)?.full_name ?? "—",
        assignedTrainerId: c.assigned_trainer_id,
        bonos: s.bonos.filter((b) => b.client_id === c.id) as BonoRow[],
      },
      trainer, world);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id, assigned_trainer_id,
       profile:profiles!clients_profile_id_fkey(full_name),
       bonos(id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at)`,
    )
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    assigned_trainer_id: string | null;
    profile: { full_name: string | null } | null;
    bonos: BonoRow[];
  };
  return shape(
    {
      id: row.id,
      name: row.profile?.full_name ?? "—",
      assignedTrainerId: row.assigned_trainer_id,
      bonos: row.bonos,
    },
    trainer, world);
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
 *   · El professional també (0107), però cada client com el veu ell
 *     (`shape`): els seus primer, els dels companys `restricted` i amb només
 *     els bons que hi pot gastar, i els demo només si ell és demo. No ho
 *     decideix la pantalla: qui crida passa `trainer` segons el rol.
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
  trainer: BookingTrainer | null,
): Promise<BookableClient[]> {
  const q = query.trim().slice(0, 60);
  const world = await getDemoWorld();
  // Els seus, primer: són els que més reserva, i amb tot el que tenen.
  const ownFirst = (list: BookableClient[]) =>
    [...list].sort((a, b) => Number(a.restricted) - Number(b.restricted));

  if (USE_MOCK) {
    const s = getStore();
    return ownFirst(
      s.clients
        .map((c) =>
          shape(
            {
              id: c.id,
              name: s.profiles.find((p) => p.id === c.profile_id)?.full_name ?? "—",
              assignedTrainerId: c.assigned_trainer_id,
              bonos: s.bonos.filter((b) => b.client_id === c.id) as BonoRow[],
            },
            trainer, world),
        )
        .filter((c): c is BookableClient => !!c && (!q || matchesName(c.name, q)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, CLIENT_SEARCH_LIMIT),
    );
  }

  // Primer els noms (una consulta petita i ordenada), després els clients
  // d'aquests noms amb els seus bons.
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
      `id, profile_id, assigned_trainer_id,
       bonos(id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at)`,
    )
    .in(
      "profile_id",
      picked.map((p) => p.id),
    );
  if (error) throw error;
  type Row = { id: string; profile_id: string; assigned_trainer_id: string | null; bonos: BonoRow[] };
  const byProfile = new Map((data as unknown as Row[]).map((c) => [c.profile_id, c]));
  return ownFirst(
    picked.flatMap((p) => {
      const c = byProfile.get(p.id);
      const shaped = c
        ? shape(
            { id: c.id, name: p.full_name ?? "—", assignedTrainerId: c.assigned_trainer_id, bonos: c.bonos },
            trainer, world)
        : null;
      return shaped ? [shaped] : [];
    }),
  );
}
