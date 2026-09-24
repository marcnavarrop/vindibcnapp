import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { getViewer, type Viewer } from "@/lib/auth";
import { mockFails } from "@/lib/mock/faults";
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

// ─── Mode demo ──────────────────────────────────────────────────────────────
//
// Al magatzem simulat no hi ha RLS, i aquí és la RLS qui ho decideix tot. Així
// que les dues policies de la 0079 es copien a mà, i NOMÉS per al mode demo:
// si algun dia canvien, s'han de canviar totes dues bandes.

/** El professional d'AQUELLA reserva: `is_session_trainer` de la 0079. */
function mockIsSessionTrainer(store: Store, viewer: Viewer, reservationId: string): boolean {
  const r = store.reservations.find((x) => x.id === reservationId);
  return !!r && r.trainer_id === viewer.id;
}

/** `session_notes_select`: l'admin, el professional de la sessió i el seu client. */
function mockCanRead(store: Store, viewer: Viewer, reservationId: string): boolean {
  if (viewer.role === "admin") return true;
  if (mockIsSessionTrainer(store, viewer, reservationId)) return true;
  const r = store.reservations.find((x) => x.id === reservationId);
  const client = r && store.clients.find((c) => c.id === r.client_id);
  return !!client && client.profile_id === viewer.id;
}

function mockNames(store: Store, ids: (string | null)[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of ids) {
    const name = id ? store.profiles.find((p) => p.id === id)?.full_name : null;
    if (id && name) out.set(id, name);
  }
  return out;
}

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

/** Quants ids van en cada consulta de notes. Cent són uns 4 kB d'URL. */
const NOTES_BATCH = 100;

export type NotesResult = {
  notes: Map<string, SessionNote>;
  /**
   * Alguna consulta ha fallat. Llavors `notes` porta les que sí que s'han pogut
   * llegir, i qui pinta ho ha de dir: si no, una nota que no surt per un error
   * no es distingeix d'una sessió que no en té.
   */
  failed: boolean;
};

/**
 * Les notes d'un grapat de reserves.
 *
 * Torna NOMÉS les que qui pregunta pot llegir: la resta simplement no hi són.
 * Les pantalles no han de filtrar res, i per això reben un `Map` i no una
 * llista amb forats.
 *
 * Els ids viatgen a la URL (`?reservation_id=in.(...)`), i per això van en
 * lots: amb centenars d'ids la petició podia passar del que el camí fins a la
 * base accepta, i com que l'error no es mirava, les notes desapareixien sense
 * avís. Ara cada lot té el seu sostre i un error es registra i es diu.
 */
export async function getNotesForReservations(
  reservationIds: string[],
): Promise<NotesResult> {
  const out = new Map<string, SessionNote>();
  if (reservationIds.length === 0) return { notes: out, failed: false };

  let rows: NoteRow[] = [];
  let names: Map<string, string>;
  let failed = false;
  if (USE_MOCK && mockFails("notes")) {
    console.error("[notes] no s'han pogut llegir les notes de sessió: error simulat");
    return { notes: out, failed: true };
  }
  if (USE_MOCK) {
    const store = getStore();
    const viewer = await getViewer();
    const wanted = new Set(reservationIds);
    rows = viewer
      ? store.session_notes.filter(
          (n) => wanted.has(n.reservation_id) && mockCanRead(store, viewer, n.reservation_id),
        )
      : [];
    names = mockNames(store, rows.map((r) => r.author_id));
  } else {
    const supabase = await createClient();
    const batches: string[][] = [];
    for (let i = 0; i < reservationIds.length; i += NOTES_BATCH)
      batches.push(reservationIds.slice(i, i + NOTES_BATCH));
    const results = await Promise.all(
      batches.map((ids) =>
        supabase.from("session_notes").select(SELECT).in("reservation_id", ids),
      ),
    );
    for (const { data, error } of results) {
      if (error) {
        failed = true;
        console.error("[notes] no s'han pogut llegir les notes de sessió:", error.message);
        continue;
      }
      rows.push(...((data ?? []) as unknown as NoteRow[]));
    }
    names = await resolveNames(rows.map((r) => r.author_id));
  }
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
  return { notes: out, failed };
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

  if (USE_MOCK) {
    // `session_notes_trainer_write`: el professional d'aquella sessió, i
    // signant amb el seu propi nom.
    const store = getStore();
    const viewer = await getViewer();
    if (
      !viewer ||
      !mockIsSessionTrainer(store, viewer, input.reservationId) ||
      input.authorId !== viewer.id
    )
      return "denied";
    const now = new Date().toISOString();
    const existing = store.session_notes.find(
      (n) => n.reservation_id === input.reservationId,
    );
    if (existing) {
      existing.author_id = input.authorId;
      existing.body = body;
      existing.updated_at = now;
    } else {
      store.session_notes.push({
        reservation_id: input.reservationId,
        author_id: input.authorId,
        body,
        created_at: now,
        updated_at: now,
      });
    }
    saveStore(store);
    return null;
  }

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
  if (USE_MOCK) {
    // Com la RLS: si no és el professional de la sessió, no s'esborra res i
    // tampoc no hi ha error.
    const store = getStore();
    const viewer = await getViewer();
    if (!viewer || !mockIsSessionTrainer(store, viewer, reservationId)) return;
    store.session_notes = store.session_notes.filter(
      (n) => n.reservation_id !== reservationId,
    );
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  await supabase.from("session_notes").delete().eq("reservation_id", reservationId);
}

/**
 * Quantes sessions passades es porten com a molt. Sense sostre, la llista (i
 * la consulta de notes, que viatja amb tots els ids a la URL) creixeria amb
 * cada setmana de client; cent són uns dos anys a una sessió per setmana.
 */
export const PAST_SESSIONS_LIMIT = 100;

/**
 * Les sessions ja passades d'un client, amb la seva nota. Les més recents,
 * fins a `PAST_SESSIONS_LIMIT`.
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
    const list = store.reservations
      .filter(
        (r) =>
          r.client_id === clientId &&
          r.status !== "cancelled" &&
          new Date(r.scheduled_at).getTime() <= now,
      )
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .slice(0, PAST_SESSIONS_LIMIT);
    const { notes } = await getNotesForReservations(list.map((r) => r.id));
    return list.map((r) => ({
      id: r.id,
      scheduledAt: r.scheduled_at,
      serviceType: r.service_type,
      status: r.status,
      trainerName:
        store.profiles.find((p) => p.id === r.trainer_id)?.full_name ?? null,
      note: notes.get(r.id) ?? null,
    }));
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("reservations")
    .select("id, scheduled_at, service_type, status, trainer_id")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(PAST_SESSIONS_LIMIT);

  const list = (rows ?? []) as unknown as {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    trainer_id: string | null;
  }[];

  // Si les notes fallen, l'error ja queda registrat a `getNotesForReservations`
  // i la llista de sessions surt igual.
  const [{ notes }, trainerNames] = await Promise.all([
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
