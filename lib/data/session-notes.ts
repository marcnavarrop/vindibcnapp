import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";
import { getStore } from "@/lib/mock/store";
import type { ServiceType, ReservationStatus } from "@/types/database";

/**
 * Nota de seguiment d'una sessió (0079).
 *
 * QUI HI ARRIBA HO DECIDEIX LA RLS, NO AQUEST FITXER
 *
 * Tot passa pel client de SERVIDOR amb la sessió de qui mira
 * (`lib/supabase/server`), mai per la clau de servei. És deliberat i és la
 * diferència amb `lib/data/client-calendar.ts`, que consulta amb la clau de
 * servei i on el que es publica ho decideix la projecció: allà una columna
 * de més filtraria dades d'altres clients sense que cap policy hi digués res.
 *
 * Aquí la porta és la policy `session_notes_select` de la 0079: el
 * professional D'AQUELLA reserva, el seu client i l'administració. Un altre
 * professional —encara que coordini el mateix client— no en treu ni una fila.
 * Si la CONSULTA de les notes fes servir `createAdminClient`, aquella garantia
 * desapareixeria i ningú se n'adonaria fins que algú es queixés.
 *
 * L'EXCEPCIÓ: ELS NOMS
 *
 * `resolveNames` sí que va amb la clau de servei, i la diferència importa.
 * `profiles_select` (0006) deixa que un CLIENT llegeixi només el seu propi
 * perfil: `id = auth.uid()`. Amb la seva sessió, doncs, un join a `profiles`
 * torna buit i la nota li sortia signada amb un guionet —justament el contrari
 * del que `author_id` existeix per garantir—. Per això `getClientCenterData`
 * també resol els noms amb la clau de servei.
 *
 * És segur perquè el que decideix QUÈ es veu ja ha passat per la RLS: els noms
 * es busquen NOMÉS per a les files que la policy ja ha deixat sortir. La clau
 * de servei no eixampla el conjunt, només li posa nom. Barrejar les dues coses
 * —fer la consulta de les notes amb la clau de servei -"total, ja filtro jo
 * després"— és el que no s'ha de fer mai.
 */

export type SessionNote = {
  reservationId: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Una sessió passada del client, amb la seva nota si n'hi ha. */
export type PastSession = {
  id: string;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
  trainerName: string | null;
  note: SessionNote | null;
};

type NoteRow = {
  reservation_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT = "reservation_id, body, author_id, created_at, updated_at";

/**
 * Els noms de qui surt a la pantalla, per id. Amb la clau de servei i NOMÉS per
 * a ids que ja han passat la RLS (vegeu la capçalera). Torna un `Map` buit si
 * no hi ha res a buscar, perquè qui crida no hagi de comprovar-ho.
 */
async function resolveNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (wanted.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", wanted);
  for (const p of data ?? []) if (p.full_name) out.set(p.id, p.full_name);
  return out;
}

/**
 * Les notes d'un grapat de reserves, en una sola consulta.
 *
 * Torna NOMÉS les que qui pregunta pot llegir: la resta simplement no hi són.
 * Les pantalles no han de filtrar res, i per això reben un `Map` i no una
 * llista amb forats.
 */
export async function getNotesForReservations(
  reservationIds: string[],
): Promise<Map<string, SessionNote>> {
  const out = new Map<string, SessionNote>();
  if (reservationIds.length === 0) return out;
  if (USE_MOCK) return out;

  const supabase = await createClient();
  const { data } = await supabase
    .from("session_notes")
    .select(SELECT)
    .in("reservation_id", reservationIds);

  const rows = (data ?? []) as unknown as NoteRow[];
  const names = await resolveNames(rows.map((r) => r.author_id));
  for (const r of rows) {
    out.set(r.reservation_id, {
      reservationId: r.reservation_id,
      body: r.body,
      authorId: r.author_id,
      authorName: r.author_id ? (names.get(r.author_id) ?? null) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }
  return out;
}

/**
 * Desa (o reescriu) la nota d'una sessió. Torna un codi d'error o `null`.
 *
 * NO comprova qui és qui: d'això se n'encarrega la policy, que és qui ho pot
 * garantir de debò. Aquí només es tradueix el "no" de la base a un missatge.
 */
export async function saveSessionNote(input: {
  reservationId: string;
  authorId: string;
  body: string;
}): Promise<"empty" | "denied" | null> {
  const body = input.body.trim();
  if (!body) return "empty";
  if (USE_MOCK) return "denied";

  const supabase = await createClient();
  const { error } = await supabase.from("session_notes").upsert(
    {
      reservation_id: input.reservationId,
      author_id: input.authorId,
      body,
    },
    { onConflict: "reservation_id" },
  );
  return error ? "denied" : null;
}

/** Esborra la nota d'una sessió. La RLS decideix si es pot. */
export async function deleteSessionNote(reservationId: string): Promise<void> {
  if (USE_MOCK) return;
  const supabase = await createClient();
  await supabase.from("session_notes").delete().eq("reservation_id", reservationId);
}

/**
 * Les sessions ja passades d'un client, amb la seva nota.
 *
 * Consulta a part i amb la sessió del client, no dins de `getClientCenterData`:
 * aquella porta les reserves de TOT el centre per pintar el calendari i les
 * filtra a la projecció. Afegir-hi la nota hauria publicat les notes dels
 * altres clients pel mateix camí.
 */
export async function listPastSessions(clientId: string): Promise<PastSession[]> {
  if (USE_MOCK) {
    const store = getStore();
    const now = Date.now();
    return store.reservations
      .filter(
        (r) =>
          r.client_id === clientId &&
          r.status !== "cancelled" &&
          new Date(r.scheduled_at).getTime() <= now,
      )
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
        trainerName:
          store.profiles.find((p) => p.id === r.trainer_id)?.full_name ?? null,
        note: null,
      }));
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("reservations")
    .select("id, scheduled_at, service_type, status, trainer_id")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false });

  const list = (rows ?? []) as unknown as {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    trainer_id: string | null;
  }[];

  const [notes, trainerNames] = await Promise.all([
    getNotesForReservations(list.map((r) => r.id)),
    resolveNames(list.map((r) => r.trainer_id)),
  ]);
  return list.map((r) => ({
    id: r.id,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
    status: r.status,
    trainerName: r.trainer_id ? (trainerNames.get(r.trainer_id) ?? null) : null,
    note: notes.get(r.id) ?? null,
  }));
}
