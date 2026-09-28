import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/mock/store";
import { mockFails } from "@/lib/mock/faults";
import { INBOX_DAYS, INBOX_LIMIT } from "@/lib/inbox-window";
import { getNotesForReservations, type SessionNote } from "@/lib/data/session-notes";
import { listActiveTrialHolds, type TrialHoldItem } from "@/lib/data/trial-bookings";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { ReservationStatus, ServiceType } from "@/types/database";

/**
 * «CAL FER»: EL QUE LA PROFESSIONAL TÉ PENDENT A LA SEVA AGENDA.
 *
 * Tres coses, les mateixes que ja pot fer avui des de la fitxa:
 *
 *   · PER MARCAR — sessions dels SEUS clients que ja han acabat i segueixen
 *     reservades. És la mateixa regla que la vora taronja de la rejilla:
 *     «Fet» el pot prémer qui porta el client, encara que la sessió la donés
 *     un company (`completeReservation` → `assertMayBookFor`).
 *   · NOTA PER ESCRIURE — sessions que ha DONAT ella, ja fetes i sense nota.
 *     La nota és de qui la va fer, no de qui coordina (policy de la 0079):
 *     per això aquesta llista va per `trainer_id` i l'anterior per client.
 *   · PROVES PER RESPONDRE — sol·licituds de /prova pendents a la seva agenda.
 *     Només si el mòdul és encès (ho decideix qui crida).
 *
 * ACOTAT, I AMB SOSTRE
 *
 * La base talla cada resposta a 1000 files sense dir-ho. Aquí no es demana mai
 * «tot el que hi ha pendent»: només els últims `INBOX_DAYS` dies, i cada
 * consulta porta un `limit` explícit. Si s'hi arriba, `truncated` ho diu i la
 * pantalla ho explica; així un sostre no es confon mai amb «no hi ha res més».
 *
 * AMB LA SESSIÓ DE QUI MIRA
 *
 * Les reserves passen pel client de SERVIDOR (RLS), com la resta de l'agenda;
 * les notes, per `getNotesForReservations`, que també; i les proves, per la
 * mateixa funció que pinta la rejilla. No s'hi eixampla cap permís.
 */


export type InboxReservation = ReservationListItem & {
  /** El client és seu: pot marcar-la feta i reprogramar-la. */
  clientMine: boolean;
};

export type TrainerInbox = {
  /** Qui mira: per decidir, a la fitxa, qui pot escriure la nota. */
  trainerId: string;
  toMark: InboxReservation[];
  toNote: InboxReservation[];
  trials: TrialHoldItem[];
  /** Les notes que ja hi ha, per a la fitxa (una per marcar pot tenir-ne). */
  notes: Record<string, SessionNote>;
  /** Alguna llista ha tocat el sostre: n'hi pot haver més de les que surten. */
  truncated: boolean;
  /** Les notes no s'han pogut llegir totes: «nota per escriure» no és fiable. */
  notesFailed: boolean;
};

type Row = {
  id: string;
  client_id: string;
  scheduled_at: string;
  ends_at: string;
  service_type: ServiceType;
  status: ReservationStatus;
  trainer_id: string | null;
  is_complimentary: boolean;
  series_id: string | null;
  client: {
    assigned_trainer_id: string | null;
    profile: { full_name: string | null } | null;
  } | null;
  trainer: { full_name: string | null } | null;
};

const toItem = (r: Row, me: string): InboxReservation => ({
  id: r.id,
  clientId: r.client_id,
  clientName: r.client?.profile?.full_name ?? "—",
  trainerId: r.trainer_id,
  trainerName: r.trainer?.full_name ?? null,
  scheduledAt: r.scheduled_at,
  serviceType: r.service_type,
  status: r.status,
  isComplimentary: r.is_complimentary,
  seriesId: r.series_id,
  clientMine: r.client?.assigned_trainer_id === me,
});

/** Les dues llistes de reserves (per marcar i per anotar), acotades. */
async function queryReservations(
  me: string,
  since: Date,
  now: Date,
): Promise<{ toMark: InboxReservation[]; done: InboxReservation[]; truncated: boolean }> {
  if (mockFails("reservations")) throw new Error("error simulat (MOCK_FAIL=reservations)");
  const sinceIso = since.toISOString();
  const nowIso = now.toISOString();

  if (USE_MOCK) {
    const s = getStore();
    const rows: Row[] = s.reservations
      .filter((r) => r.scheduled_at >= sinceIso && r.ends_at <= nowIso)
      .map((r) => {
        const c = s.clients.find((x) => x.id === r.client_id);
        return {
          ...r,
          client: c
            ? {
                assigned_trainer_id: c.assigned_trainer_id,
                profile: { full_name: s.profiles.find((p) => p.id === c.profile_id)?.full_name ?? null },
              }
            : null,
          trainer: r.trainer_id
            ? { full_name: s.profiles.find((p) => p.id === r.trainer_id)?.full_name ?? null }
            : null,
        };
      })
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
    const toMark = rows
      .filter((r) => r.status === "booked" && r.client?.assigned_trainer_id === me)
      .slice(0, INBOX_LIMIT);
    const done = rows
      .filter((r) => r.status === "completed" && r.trainer_id === me)
      .slice(0, INBOX_LIMIT);
    return {
      toMark: toMark.map((r) => toItem(r, me)),
      done: done.map((r) => toItem(r, me)),
      truncated: toMark.length === INBOX_LIMIT || done.length === INBOX_LIMIT,
    };
  }

  const supabase = await createClient();
  const select = `id, client_id, scheduled_at, ends_at, service_type, status, trainer_id, is_complimentary, series_id,
     client:clients!reservations_client_id_fkey!inner(assigned_trainer_id, profile:profiles!clients_profile_id_fkey(full_name)),
     trainer:profiles!reservations_trainer_id_fkey(full_name)`;
  // Les més recents primer: si mai s'arriba al sostre, el que cau és el més vell.
  const [mark, done] = await Promise.all([
    supabase
      .from("reservations")
      .select(select)
      .eq("status", "booked")
      .eq("client.assigned_trainer_id", me)
      .gte("scheduled_at", sinceIso)
      .lte("ends_at", nowIso)
      .order("scheduled_at", { ascending: false })
      .limit(INBOX_LIMIT),
    supabase
      .from("reservations")
      .select(select)
      .eq("status", "completed")
      .eq("trainer_id", me)
      .gte("scheduled_at", sinceIso)
      .lte("ends_at", nowIso)
      .order("scheduled_at", { ascending: false })
      .limit(INBOX_LIMIT),
  ]);
  if (mark.error) throw mark.error;
  if (done.error) throw done.error;
  const markRows = (mark.data ?? []) as unknown as Row[];
  const doneRows = (done.data ?? []) as unknown as Row[];
  return {
    toMark: markRows.map((r) => toItem(r, me)),
    done: doneRows.map((r) => toItem(r, me)),
    truncated: markRows.length === INBOX_LIMIT || doneRows.length === INBOX_LIMIT,
  };
}

export async function getTrainerInbox(input: {
  trainerId: string;
  /** El mòdul de sessions de prova és encès. */
  trials: boolean;
  now?: Date;
}): Promise<TrainerInbox> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - INBOX_DAYS * 86_400_000);
  const [res, trialHolds] = await Promise.all([
    queryReservations(input.trainerId, since, now),
    input.trials
      ? // Les que encara es poden respondre: pendents i per venir. Una
        // pendent caduca sola (`expires_at`), així que la llista és curta.
        listActiveTrialHolds({ from: now, trainerId: input.trainerId }).then((l) =>
          l.filter((t) => t.status === "pending"),
        )
      : Promise.resolve([]),
  ]);

  const { notes, failed } = await getNotesForReservations([
    ...res.toMark.map((r) => r.id),
    ...res.done.map((r) => r.id),
  ]);
  return {
    trainerId: input.trainerId,
    toMark: res.toMark,
    // Si les notes no s'han pogut llegir, no s'acusa ningú de no haver-ne escrit.
    toNote: failed ? [] : res.done.filter((r) => !notes.has(r.id)),
    trials: trialHolds,
    notes: Object.fromEntries(notes),
    truncated: res.truncated,
    notesFailed: failed,
  };
}
