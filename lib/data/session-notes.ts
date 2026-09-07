import "server-only";
import { createClient } from "@/lib/supabase/server";
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
 * Si aquest fitxer fes servir `createAdminClient`, aquella garantia
 * desapareixeria i ningú se n'adonaria fins que algú es queixés.
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
  author: { full_name: string | null } | null;
};

function toNote(r: NoteRow): SessionNote {
  return {
    reservationId: r.reservation_id,
    body: r.body,
    authorId: r.author_id,
    authorName: r.author?.full_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT =
  "reservation_id, body, author_id, created_at, updated_at, author:profiles!session_notes_author_id_fkey(full_name)";

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
  for (const row of (data ?? []) as unknown as NoteRow[]) {
    out.set(row.reservation_id, toNote(row));
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
    .select(
      `id, scheduled_at, service_type, status,
       trainer:profiles!reservations_trainer_id_fkey(full_name)`,
    )
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false });

  const list = (rows ?? []) as unknown as {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    trainer: { full_name: string | null } | null;
  }[];

  const notes = await getNotesForReservations(list.map((r) => r.id));
  return list.map((r) => ({
    id: r.id,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
    status: r.status,
    trainerName: r.trainer?.full_name ?? null,
    note: notes.get(r.id) ?? null,
  }));
}
