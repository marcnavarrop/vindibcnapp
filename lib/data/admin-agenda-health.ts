import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/mock/store";
import { mockFails } from "@/lib/mock/faults";
import { listTrainers } from "@/lib/data/clients";
import { findOrphans, orphanCount } from "@/lib/data/availability-orphans";
import { listWaitingForAdmin } from "@/lib/data/waitlist";
import { addDaysStr, centerDateStr, centerDayStart, centerToday, centerWeekStart } from "@/lib/center-time";
import { GROUP_CAPACITY } from "@/lib/labels";
import { INBOX_DAYS } from "@/lib/inbox-window";

/**
 * L'ESTAT DE L'AGENDA, PER A L'INICI DE L'ADMIN.
 *
 * Tres coses que abans només es veien entrant a l'agenda o a la disponibilitat
 * de cada professional, una per una:
 *
 *   · Les sessions que ja han passat i ningú no ha marcat, de tot el centre,
 *     per professional. No marcar-les vol dir que no es paguen (liquidacions).
 *   · Les reserves que han quedat fora de la disponibilitat del seu
 *     professional: el MATEIX detector del plafó de Disponibilitat
 *     (`findOrphans`), perquè els dos números no es puguin contradir.
 *   · Els grups plens amb gent esperant, d'aquí al diumenge.
 *
 * Cada lectura és independent i torna el seu propi error: si una falla, la seva
 * targeta ho diu i les altres dues surten igual. Un zero només vol dir zero.
 */

/** Sostre de «Sense marcar» per a tot el centre. */
export const UNMARKED_LIMIT = 300;

export type Loaded<T> = { ok: true; data: T } | { ok: false };

export type UnmarkedSession = { id: string; clientName: string; scheduledAt: string };
export type UnmarkedByTrainer = {
  total: number;
  /** S'ha arribat al sostre: n'hi pot haver més dels que es compten. */
  truncated: boolean;
  trainers: { id: string | null; name: string; sessions: UnmarkedSession[] }[];
};

export type OutOfAvailability = {
  total: number;
  trainers: { id: string; name: string; count: number }[];
};

export type FullGroup = {
  trainerId: string;
  trainerName: string;
  at: string;
  booked: number;
  waiting: string[];
};

async function safe<T>(label: string, fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error(`[inici admin] ${label}:`, e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

/**
 * Sense marcar: 'booked' i ja acabades, dels últims `INBOX_DAYS` dies (els
 * mateixos que «Cal fer» del professional), les més recents primer i com a molt
 * `UNMARKED_LIMIT`.
 */
async function unmarked(now: Date): Promise<UnmarkedByTrainer> {
  if (mockFails("unmarked")) throw new Error("error simulat (MOCK_FAIL=unmarked)");
  const sinceIso = new Date(now.getTime() - INBOX_DAYS * 86_400_000).toISOString();
  const nowIso = now.toISOString();

  type Row = { id: string; scheduled_at: string; trainer_id: string | null; clientName: string; trainerName: string | null };
  let rows: Row[];
  if (USE_MOCK) {
    const s = getStore();
    const name = (profileId: string | null | undefined) =>
      s.profiles.find((p) => p.id === profileId)?.full_name ?? null;
    rows = s.reservations
      .filter((r) => r.status === "booked" && r.scheduled_at >= sinceIso && r.ends_at <= nowIso)
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .slice(0, UNMARKED_LIMIT)
      .map((r) => ({
        id: r.id,
        scheduled_at: r.scheduled_at,
        trainer_id: r.trainer_id,
        clientName: name(s.clients.find((c) => c.id === r.client_id)?.profile_id) ?? "—",
        trainerName: name(r.trainer_id),
      }));
  } else {
    const { data, error } = await (await createClient())
      .from("reservations")
      .select(
        `id, scheduled_at, trainer_id,
         client:clients!reservations_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name)),
         trainer:profiles!reservations_trainer_id_fkey(full_name)`,
      )
      .eq("status", "booked")
      .gte("scheduled_at", sinceIso)
      .lte("ends_at", nowIso)
      .order("scheduled_at", { ascending: false })
      .limit(UNMARKED_LIMIT);
    if (error) throw error;
    type Raw = {
      id: string;
      scheduled_at: string;
      trainer_id: string | null;
      client: { profile: { full_name: string | null } | null } | null;
      trainer: { full_name: string | null } | null;
    };
    rows = (data as unknown as Raw[]).map((r) => ({
      id: r.id,
      scheduled_at: r.scheduled_at,
      trainer_id: r.trainer_id,
      clientName: r.client?.profile?.full_name ?? "—",
      trainerName: r.trainer?.full_name ?? null,
    }));
  }

  const byTrainer = new Map<string, UnmarkedByTrainer["trainers"][number]>();
  for (const r of rows) {
    const k = r.trainer_id ?? "";
    const t =
      byTrainer.get(k) ??
      byTrainer.set(k, { id: r.trainer_id, name: r.trainerName ?? "Sense professional", sessions: [] }).get(k)!;
    t.sessions.push({ id: r.id, clientName: r.clientName, scheduledAt: r.scheduled_at });
  }
  return {
    total: rows.length,
    truncated: rows.length === UNMARKED_LIMIT,
    // Qui en té més, primer.
    trainers: [...byTrainer.values()].sort((a, b) => b.sessions.length - a.sessions.length || a.name.localeCompare(b.name)),
  };
}

/** Fora de disponibilitat: el detector del plafó, professional per professional. */
async function outOfAvailability(): Promise<OutOfAvailability> {
  if (mockFails("orphans")) throw new Error("error simulat (MOCK_FAIL=orphans)");
  const trainers = await listTrainers();
  const counts = await Promise.all(
    trainers.map(async (t) => ({ id: t.id, name: t.name, count: orphanCount(await findOrphans(t.id)) })),
  );
  const withSome = counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { total: withSome.reduce((n, c) => n + c.count, 0), trainers: withSome };
}

/**
 * Grups plens amb espera, d'ara al diumenge d'aquesta setmana. La cua ve de
 * `listWaitingForAdmin` (noms per ordre); les places, de les reserves de grup
 * d'aquestes franges.
 */
async function fullGroups(now: Date): Promise<FullGroup[]> {
  if (mockFails("waitlist")) throw new Error("error simulat (MOCK_FAIL=waitlist)");
  const today = centerToday();
  const weekEnd = addDaysStr(centerWeekStart(today), 6);
  const queues = (await listWaitingForAdmin({ fromDay: today, toDay: weekEnd })).filter(
    (q) => new Date(q.at).getTime() > now.getTime(),
  );
  if (queues.length === 0) return [];

  const from = centerDayStart(today).toISOString();
  const to = centerDayStart(addDaysStr(weekEnd, 1)).toISOString();
  type Row = { trainer_id: string | null; scheduled_at: string };
  let rows: Row[];
  if (USE_MOCK) {
    rows = getStore().reservations.filter(
      (r) => r.status === "booked" && r.service_type === "grupo_reducido" && r.scheduled_at >= from && r.scheduled_at < to,
    );
  } else {
    // Una setmana de grups: molt per sota del sostre; el `limit` hi és igualment.
    const { data, error } = await (await createClient())
      .from("reservations")
      .select("trainer_id, scheduled_at")
      .eq("status", "booked")
      .eq("service_type", "grupo_reducido")
      .gte("scheduled_at", from)
      .lt("scheduled_at", to)
      .limit(1000);
    if (error) throw error;
    rows = data ?? [];
  }
  const booked = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.trainer_id}|${new Date(r.scheduled_at).getTime()}`;
    booked.set(k, (booked.get(k) ?? 0) + 1);
  }
  const names = new Map((await listTrainers()).map((t) => [t.id, t.name]));
  return queues
    .map((q) => ({
      trainerId: q.trainerId,
      trainerName: names.get(q.trainerId) ?? "—",
      at: q.at,
      booked: booked.get(`${q.trainerId}|${new Date(q.at).getTime()}`) ?? 0,
      waiting: q.names,
    }))
    // Una cua en un grup que ja no és ple vol dir que la plaça està a punt de
    // donar-se: també es diu, però primer els plens.
    .sort((a, b) => Number(b.booked >= GROUP_CAPACITY) - Number(a.booked >= GROUP_CAPACITY) || a.at.localeCompare(b.at));
}

export type AgendaHealth = {
  unmarked: Loaded<UnmarkedByTrainer>;
  outOfAvailability: Loaded<OutOfAvailability>;
  fullGroups: Loaded<FullGroup[]>;
};

export async function getAgendaHealth(now = new Date()): Promise<AgendaHealth> {
  const [u, o, g] = await Promise.all([
    safe("sense marcar", () => unmarked(now)),
    safe("fora de disponibilitat", outOfAvailability),
    safe("grups plens", () => fullGroups(now)),
  ]);
  return { unmarked: u, outOfAvailability: o, fullGroups: g };
}

/** El dia (del centre) d'un instant, per als enllaços a l'agenda. */
export const dayOf = (iso: string) => centerDateStr(new Date(iso));
