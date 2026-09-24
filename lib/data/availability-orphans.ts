import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { listAvailabilityRules, type AvailabilityRule } from "@/lib/data/availability";
import { listBlocksLite } from "@/lib/data/availability-blocks";
import { cancelReservationsByCenter } from "@/lib/data/reservations";
import { rejectTrial } from "@/lib/data/trial-bookings";
import { isSessionCovered } from "@/lib/availability-coverage";
import {
  startSlotOf,
  endSlotOf,
  type AvailabilityRuleLite,
  type AvailabilityBlockLite,
} from "@/lib/availability-slots";
import { centerLocalToInstant, centerToday } from "@/lib/center-time";
import { SESSION_DURATION_MINUTES } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

/**
 * Reserves ORFES: les que un tancament de disponibilitat deixa sense on caure.
 *
 * Una reserva és orfe si és futura, 'booked', de l'agenda d'aquest
 * professional, i la seva sessió ja no està coberta (`isSessionCovered`): cap
 * regla vigent n'ofereix el servei a aquella hora, o un bloqueig la toca. Si una
 * altra regla segueix cobrint la franja, NO és orfe i no es toca.
 *
 * Amb les reserves hi van dues coses més que viuen a la mateixa franja:
 *   · les proves de /prova vives ('pending' sense caducar, o 'confirmed'),
 *   · les entrades de la llista d'espera 'waiting' d'aquest professional.
 *
 * QUI HO FA SERVIR
 *
 *   · El pas de confirmació de les quatre vies que tanquen disponibilitat
 *     (esborrar una franja, editar-la, canviar-ne la vigència, crear un
 *     bloqueig): `previewOrphans` compara l'abans i el després i en llista
 *     només les que el canvi deixa orfes.
 *   · El plafó permanent «Reserves fora de la teva disponibilitat»:
 *     `findOrphans` amb l'estat d'ara, que ensenya també les que ja ho eren
 *     d'abans (per exemple, perquè es va decidir mantenir-les).
 *
 * NO ES CANCEL·LA RES EN SILENCI: aquí només es troba. Cancel·lar és
 * `cancelOrphans`, i només el que s'ha marcat i segueix sent orfe.
 */

export type OrphanReservation = {
  kind: "reservation";
  id: string;
  clientName: string;
  scheduledAt: string;
  serviceType: ServiceType;
  /** Sense bo: no hi ha cap sessió a retornar. */
  complimentary: boolean;
  /** El bo ja ha caducat: la sessió hi tornarà, però no es podrà fer servir. */
  bonoExpired: boolean;
  /** Forma part d'una sèrie (la sèrie continua; aquesta no compta). */
  inSeries: boolean;
};

export type OrphanTrial = {
  kind: "trial";
  id: string;
  name: string;
  scheduledAt: string;
  serviceType: ServiceType;
};

export type OrphanWaitlist = {
  kind: "waitlist";
  id: string;
  clientName: string;
  scheduledAt: string;
  serviceType: ServiceType;
};

export type Orphans = {
  reservations: OrphanReservation[];
  trials: OrphanTrial[];
  waitlist: OrphanWaitlist[];
};

export const NO_ORPHANS: Orphans = { reservations: [], trials: [], waitlist: [] };

export function orphanCount(o: Orphans): number {
  return o.reservations.length + o.trials.length + o.waitlist.length;
}

/** L'estat de disponibilitat que es vol avaluar. */
export type AvailabilityState = {
  rules: AvailabilityRuleLite[];
  blocks: AvailabilityBlockLite[];
};

/** Una regla de la pantalla de gestió, en la forma que entén el predicat. */
export function ruleToLite(r: {
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string;
  validUntil: string | null;
  serviceTypes: ServiceType[];
}): AvailabilityRuleLite {
  return {
    weekday: r.weekday,
    // Cap a dins, com `toLite` d'availability.ts: una regla mai ofereix més
    // del que declara.
    startSlot: startSlotOf(r.startTime),
    endSlot: endSlotOf(r.endTime),
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    serviceTypes: r.serviceTypes,
  };
}

/** L'estat d'ara: les regles (amb id, per poder-hi aplicar canvis) i els bloquejos. */
export async function currentAvailability(trainerId: string): Promise<{
  rules: AvailabilityRule[];
  blocks: AvailabilityBlockLite[];
}> {
  const [rules, blocks] = await Promise.all([
    listAvailabilityRules(trainerId),
    listBlocksLite(trainerId),
  ]);
  return { rules, blocks };
}

// ─── Els compromisos futurs d'una agenda ─────────────────────────────────────

type Commitments = {
  reservations: (OrphanReservation & { durationMinutes: number })[];
  trials: OrphanTrial[];
  waitlist: OrphanWaitlist[];
};

/**
 * Tot el que aquesta agenda té compromès d'ara endavant. Amb la clau de servei:
 * qui pot mirar-ho ja ho ha decidit l'acció (l'admin, o el professional sobre
 * la seva agenda), i les proves i la llista d'espera no les podria llegir sencer
 * amb el client de sessió.
 */
async function loadCommitments(trainerId: string): Promise<Commitments> {
  const nowIso = new Date().toISOString();
  const today = centerToday();
  const expired = (status: string, expiresAt: string | null | undefined) =>
    status === "expired" || (!!expiresAt && expiresAt < today);

  if (USE_MOCK) {
    const store = getStore();
    const nameOf = (clientId: string) => {
      const c = store.clients.find((x) => x.id === clientId);
      return store.profiles.find((p) => p.id === c?.profile_id)?.full_name ?? "—";
    };
    return {
      reservations: store.reservations
        .filter(
          (r) =>
            r.trainer_id === trainerId &&
            r.status === "booked" &&
            r.scheduled_at > nowIso,
        )
        .map((r) => {
          const b = r.bono_id ? store.bonos.find((x) => x.id === r.bono_id) : null;
          return {
            kind: "reservation" as const,
            id: r.id,
            clientName: nameOf(r.client_id),
            scheduledAt: r.scheduled_at,
            serviceType: r.service_type,
            durationMinutes: r.duration_minutes ?? SESSION_DURATION_MINUTES,
            complimentary: !r.bono_id,
            bonoExpired: !!b && expired(b.status, b.expires_at),
            inSeries: !!r.series_id,
          };
        }),
      trials: store.trial_bookings
        .filter(
          (t) =>
            t.trainer_id === trainerId &&
            t.scheduled_at > nowIso &&
            (t.status === "confirmed" ||
              (t.status === "pending" && t.expires_at >= nowIso)),
        )
        .map((t) => ({
          kind: "trial" as const,
          id: t.id,
          name: t.full_name,
          scheduledAt: t.scheduled_at,
          serviceType: t.service_type,
        })),
      waitlist: store.waitlist_entries
        .filter(
          (w) =>
            w.trainer_id === trainerId &&
            w.status === "waiting" &&
            w.desired_date >= today,
        )
        .map((w) => ({
          kind: "waitlist" as const,
          id: w.id,
          clientName: nameOf(w.client_id),
          scheduledAt: centerLocalToInstant(
            w.desired_date,
            w.desired_time.slice(0, 5),
          ).toISOString(),
          serviceType: w.service_type,
        }))
        .filter((w) => w.scheduledAt > nowIso),
    };
  }

  const admin = createAdminClient();
  const [resQ, trialQ, waitQ] = await Promise.all([
    admin
      .from("reservations")
      .select(
        `id, client_id, bono_id, scheduled_at, duration_minutes, service_type, series_id,
         client:clients!reservations_client_id_fkey(
           profile:profiles!clients_profile_id_fkey(full_name))`,
      )
      .eq("trainer_id", trainerId)
      .eq("status", "booked")
      .gt("scheduled_at", nowIso)
      .order("scheduled_at"),
    admin
      .from("trial_bookings")
      .select("id, full_name, scheduled_at, service_type, status, expires_at")
      .eq("trainer_id", trainerId)
      .gt("scheduled_at", nowIso)
      .in("status", ["pending", "confirmed"]),
    admin
      .from("waitlist_entries")
      .select("id, client_id, desired_date, desired_time, service_type")
      .eq("trainer_id", trainerId)
      .eq("status", "waiting")
      .gte("desired_date", today),
  ]);
  if (resQ.error) throw resQ.error;
  if (trialQ.error) throw trialQ.error;
  if (waitQ.error) throw waitQ.error;

  type ResRow = {
    id: string;
    client_id: string;
    bono_id: string | null;
    scheduled_at: string;
    duration_minutes: number | null;
    service_type: ServiceType;
    series_id: string | null;
    client: { profile: { full_name: string | null } | null } | null;
  };
  const resRows = (resQ.data ?? []) as unknown as ResRow[];

  // Els bons i els noms de la llista d'espera, a part: dues consultes més i cap
  // relació incrustada que depengui del nom d'una clau forana.
  const bonoIds = [...new Set(resRows.map((r) => r.bono_id).filter(Boolean))] as string[];
  const waitClientIds = [...new Set((waitQ.data ?? []).map((w) => w.client_id))];
  const [bonosQ, waitClientsQ] = await Promise.all([
    bonoIds.length
      ? admin.from("bonos").select("id, status, expires_at").in("id", bonoIds)
      : Promise.resolve({ data: [], error: null }),
    waitClientIds.length
      ? admin
          .from("clients")
          .select("id, profile:profiles!clients_profile_id_fkey(full_name)")
          .in("id", waitClientIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (bonosQ.error) throw bonosQ.error;
  if (waitClientsQ.error) throw waitClientsQ.error;
  const bonoById = new Map(
    ((bonosQ.data ?? []) as { id: string; status: string; expires_at: string | null }[]).map(
      (b) => [b.id, b],
    ),
  );
  const waitName = new Map(
    (
      (waitClientsQ.data ?? []) as unknown as {
        id: string;
        profile: { full_name: string | null } | null;
      }[]
    ).map((c) => [c.id, c.profile?.full_name ?? "—"]),
  );

  return {
    reservations: resRows.map((r) => {
      const b = r.bono_id ? bonoById.get(r.bono_id) : undefined;
      return {
        kind: "reservation" as const,
        id: r.id,
        clientName: r.client?.profile?.full_name ?? "—",
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        durationMinutes: r.duration_minutes ?? SESSION_DURATION_MINUTES,
        complimentary: !r.bono_id,
        bonoExpired: !!b && expired(b.status, b.expires_at),
        inSeries: !!r.series_id,
      };
    }),
    trials: (trialQ.data ?? [])
      .filter((t) => t.status === "confirmed" || t.expires_at >= nowIso)
      .map((t) => ({
        kind: "trial" as const,
        id: t.id,
        name: t.full_name,
        scheduledAt: t.scheduled_at,
        serviceType: t.service_type,
      })),
    waitlist: (waitQ.data ?? [])
      .map((w) => ({
        kind: "waitlist" as const,
        id: w.id,
        clientName: waitName.get(w.client_id) ?? "—",
        scheduledAt: centerLocalToInstant(
          w.desired_date,
          String(w.desired_time).slice(0, 5),
        ).toISOString(),
        serviceType: w.service_type,
      }))
      .filter((w) => w.scheduledAt > nowIso),
  };
}

/** Els compromisos que un estat de disponibilitat NO cobreix. */
function uncovered(c: Commitments, state: AvailabilityState): Orphans {
  const covered = (at: string, mins: number, service: ServiceType) =>
    isSessionCovered(state.rules, state.blocks, at, mins, service);
  return {
    reservations: c.reservations
      .filter((r) => !covered(r.scheduledAt, r.durationMinutes, r.serviceType))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ durationMinutes, ...r }) => r),
    // Les proves són sessions estàndard (0083/0084 fan el mateix).
    trials: c.trials.filter(
      (t) => !covered(t.scheduledAt, SESSION_DURATION_MINUTES, t.serviceType),
    ),
    waitlist: c.waitlist.filter(
      (w) => !covered(w.scheduledAt, SESSION_DURATION_MINUTES, w.serviceType),
    ),
  };
}

const byTime = <T extends { scheduledAt: string }>(a: T, b: T) =>
  a.scheduledAt.localeCompare(b.scheduledAt);

/** Tot el que ara mateix cau fora de la disponibilitat d'aquest professional. */
export async function findOrphans(trainerId: string): Promise<Orphans> {
  const [c, now] = await Promise.all([
    loadCommitments(trainerId),
    currentAvailability(trainerId),
  ]);
  const o = uncovered(c, { rules: now.rules.map(ruleToLite), blocks: now.blocks });
  return {
    reservations: o.reservations.sort(byTime),
    trials: o.trials.sort(byTime),
    waitlist: o.waitlist.sort(byTime),
  };
}

/**
 * El que un canvi deixaria orfe: orfe DESPRÉS i no ABANS.
 *
 * Els que ja ho eren abans no surten aquí —el canvi que s'està fent no hi té
 * res a veure, i demanar-ho en cada edició seria soroll—; es veuen al plafó.
 * `apply` rep l'estat d'ara i torna el que quedaria.
 */
export async function previewOrphans(
  trainerId: string,
  apply: (now: { rules: AvailabilityRule[]; blocks: AvailabilityBlockLite[] }) => {
    rules: AvailabilityRule[];
    blocks: AvailabilityBlockLite[];
  },
): Promise<Orphans> {
  const [c, now] = await Promise.all([
    loadCommitments(trainerId),
    currentAvailability(trainerId),
  ]);
  const after = apply(now);
  const before = uncovered(c, { rules: now.rules.map(ruleToLite), blocks: now.blocks });
  const then = uncovered(c, { rules: after.rules.map(ruleToLite), blocks: after.blocks });
  const was = new Set([
    ...before.reservations.map((r) => r.id),
    ...before.trials.map((t) => t.id),
    ...before.waitlist.map((w) => w.id),
  ]);
  return {
    reservations: then.reservations.filter((r) => !was.has(r.id)).sort(byTime),
    trials: then.trials.filter((t) => !was.has(t.id)).sort(byTime),
    waitlist: then.waitlist.filter((w) => !was.has(w.id)).sort(byTime),
  };
}

// ─── Cancel·lar el que s'ha marcat ───────────────────────────────────────────

export type OrphanSelection = {
  reservationIds: string[];
  trialIds: string[];
  waitlistIds: string[];
};

/** Llegeix del formulari què s'ha marcat per cancel·lar. */
export function selectionFromForm(fd: FormData): OrphanSelection {
  const ids = (name: string) =>
    [...new Set(fd.getAll(name).map(String).filter(Boolean))];
  return {
    reservationIds: ids("cancelReservationIds"),
    trialIds: ids("cancelTrialIds"),
    waitlistIds: ids("cancelWaitlistIds"),
  };
}

export type CancelOutcome = {
  reservations: number;
  trials: number;
  waitlist: number;
  /** Què no s'ha pogut fer. Buit si tot ha anat bé. */
  failures: string[];
};

/**
 * Cancel·la el que s'ha marcat i SEGUEIX sent orfe ara mateix.
 *
 * Es torna a calcular: entre la confirmació i aquest moment algú pot haver
 * cancel·lat una reserva o obert una altra franja que la torni a cobrir, i
 * cancel·lar-la llavors seria cancel·lar una reserva que ja té on caure.
 *
 * S'ha de cridar DESPRÉS de desar el canvi de disponibilitat. Si falla a mig
 * camí, el pitjor estat és el d'avui —disponibilitat canviada i reserves encara
 * 'booked'—, i el plafó les ensenya per tornar-ho a provar. Mai no queda una
 * reserva cancel·lada sense la seva sessió: això ho fa en una sola transacció
 * `cancel_reservations_by_center` (0090).
 *
 * `actingTrainerId`: el professional que ho fa, o null si és l'admin. Les proves
 * el necessiten (`rejectTrial` comprova que la prova sigui seva).
 */
export async function cancelOrphans(
  trainerId: string,
  actingTrainerId: string | null,
  sel: OrphanSelection,
): Promise<CancelOutcome> {
  const out: CancelOutcome = { reservations: 0, trials: 0, waitlist: 0, failures: [] };
  if (!sel.reservationIds.length && !sel.trialIds.length && !sel.waitlistIds.length)
    return out;

  const still = await findOrphans(trainerId);
  const ok = (ids: string[], list: { id: string }[]) => {
    const set = new Set(list.map((x) => x.id));
    return ids.filter((id) => set.has(id));
  };
  const resIds = ok(sel.reservationIds, still.reservations);
  const trialIds = ok(sel.trialIds, still.trials);
  const waitIds = ok(sel.waitlistIds, still.waitlist);

  // 1. Les reserves: una sola transacció a la base, amb la sessió al bo i sense
  //    promocionar ningú de la cua a una franja que ja no existeix.
  if (resIds.length) {
    try {
      out.reservations = (await cancelReservationsByCenter(trainerId, resIds)).length;
    } catch {
      out.failures.push(
        "No s'han pogut cancel·lar les reserves. Continuen reservades i les tens al plafó «Reserves fora de la teva disponibilitat».",
      );
    }
  }

  // 2. Les proves: el camí de sempre, que avisa la persona per correu.
  for (const id of trialIds) {
    try {
      await rejectTrial(id, actingTrainerId);
      out.trials++;
    } catch {
      out.failures.push("Alguna sessió de prova no s'ha pogut anul·lar.");
    }
  }

  // 3. La llista d'espera: una espera d'una franja que ja no existeix no es
  //    podrà complir mai. Es tanca sense promocionar ningú.
  if (waitIds.length) {
    try {
      out.waitlist = await closeWaitlistEntries(waitIds);
    } catch {
      out.failures.push("No s'han pogut treure les esperes de la llista.");
    }
  }

  out.failures = [...new Set(out.failures)];
  return out;
}

async function closeWaitlistEntries(ids: string[]): Promise<number> {
  if (USE_MOCK) {
    const store = getStore();
    let n = 0;
    for (const w of store.waitlist_entries)
      if (ids.includes(w.id) && w.status === "waiting") {
        w.status = "cancelled";
        w.cancelled_by_center = true;
        n++;
      }
    saveStore(store);
    return n;
  }
  const { data, error } = await createAdminClient()
    .from("waitlist_entries")
    // Marcada com a tancada pel CENTRE (0091): una sèrie no la compta com a
    // ocurrència col·locada, igual que les reserves amb `cancelled_by_center`.
    .update({ status: "cancelled", cancelled_by_center: true })
    .in("id", ids)
    .eq("status", "waiting")
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

// ─── Qui actua, i què se li diu després ──────────────────────────────────────

/**
 * Qui fa el canvi. L'admin pot tocar qualsevol agenda; el professional, només
 * la seva. Es mira ABANS de llegir res: la llista d'orfes porta noms de clients.
 */
export type Actor = { role: "admin" } | { role: "trainer"; id: string };

export function mayManage(actor: Actor, trainerId: string): boolean {
  return actor.role === "admin" || actor.id === trainerId;
}

/** El professional que actua, o null si és l'admin (el que espera `rejectTrial`). */
export function actingTrainerId(actor: Actor): string | null {
  return actor.role === "trainer" ? actor.id : null;
}

/** El que s'ha fet, en una frase; i el que no, a part. */
export function outcomeSummary(o: CancelOutcome): {
  notice: string | null;
  warning: string | null;
} {
  const parts: string[] = [];
  if (o.reservations)
    parts.push(
      o.reservations === 1 ? "1 reserva cancel·lada" : `${o.reservations} reserves cancel·lades`,
    );
  if (o.trials)
    parts.push(
      o.trials === 1 ? "1 sessió de prova anul·lada" : `${o.trials} sessions de prova anul·lades`,
    );
  if (o.waitlist)
    parts.push(
      o.waitlist === 1 ? "1 espera tancada" : `${o.waitlist} esperes tancades`,
    );
  return {
    notice: parts.length ? `${parts.join(", ")}.` : null,
    warning: o.failures.length ? o.failures.join(" ") : null,
  };
}
