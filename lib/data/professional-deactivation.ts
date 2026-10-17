import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { getDemoWorld } from "@/lib/data/demo-world";
import { isDemoTrainer } from "@/lib/demo-accounts";
import { listTrainers, reassignClientTrainer } from "@/lib/data/clients";
import { cancelReservationsByCenter } from "@/lib/data/reservations";
import { rejectTrial } from "@/lib/data/trial-bookings";
import { cancelWaitsOfProfessional, notifyCancelledWaits } from "@/lib/data/waitlist";
import { logDataAccess } from "@/lib/data/data-access-log";
import type { ServiceType, Specialty, TrialStatus, UserRole } from "@/types/database";

/**
 * DONAR DE BAIXA UN PROFESSIONAL (0128): desactivar-lo, de manera reversible.
 *
 * Decisió d'en Marc (17/10/2026, opció A): no s'esborra res. El perfil queda
 * marcat (`deactivated_at`), bloquejat a Auth (ban) i, per si de cas, la base
 * ja no el compta com a equip (`current_role()`, `is_trainer()`, `is_physio()`).
 * Tot el seu historial es queda amb el seu nom, i es pot reactivar.
 *
 * Abans, el que depèn d'ell s'ha de resoldre, i ho resol la mateixa baixa:
 *   · CLIENTS ASSIGNATS → a un altre professional (del mateix món, demo amb
 *     demo) o sense professional; ho tria l'admin.
 *   · RESERVES FUTURES → es cancel·len en nom del centre, en una sola
 *     transacció (`cancel_reservations_by_center`, 0090): la sessió torna al bo
 *     i el client rep el correu. Si se'n vol passar alguna a un altre
 *     professional, es fa abans des de l'agenda.
 *   · SÈRIES → es tanquen ('cancelled'): sense ell no se'n pot reservar cap més.
 *   · ESPERES → s'anul·len (`cancel_reason = 'professional_baixa'`) i s'avisa el
 *     client en el moment (`notifyCancelledWaits`).
 *   · PROVES pendents o confirmades → s'anul·len pel camí de sempre
 *     (`rejectTrial`), que avisa la persona.
 *
 * Mai sobre un mateix, i només professionals: un administrador no es dona de
 * baixa des d'aquí (així mai no es queda el centre sense cap admin).
 */

export type ProfessionalForBaixa = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  specialty: Specialty | null;
  deactivatedAt: string | null;
  isDemo: boolean;
};

export type BaixaImpact = {
  professional: ProfessionalForBaixa;
  clients: { id: string; name: string }[];
  reservations: { id: string; scheduledAt: string; serviceType: ServiceType; clientName: string }[];
  series: { id: string; clientName: string }[];
  waits: { id: string; desiredDate: string; desiredTime: string; serviceType: ServiceType; clientName: string }[];
  trials: { id: string; scheduledAt: string; fullName: string; status: TrialStatus }[];
  /** A qui es poden passar els clients: actius, del mateix món, i no ell. */
  reassignTargets: { id: string; name: string }[];
};

const ACTIVE_TRIAL: TrialStatus[] = ["pending", "confirmed"];

async function getProfessional(id: string): Promise<ProfessionalForBaixa | null> {
  const world = await getDemoWorld();
  if (USE_MOCK) {
    const p = getStore().profiles.find((x) => x.id === id);
    return p
      ? {
          id: p.id,
          fullName: p.full_name ?? "—",
          email: p.email ?? "",
          role: p.role,
          specialty: p.specialty,
          deactivatedAt: p.deactivated_at ?? null,
          isDemo: isDemoTrainer(world, p.id),
        }
      : null;
  }
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email, role, specialty, deactivated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        fullName: data.full_name ?? "—",
        email: data.email ?? "",
        role: data.role,
        specialty: data.specialty,
        deactivatedAt: data.deactivated_at ?? null,
        isDemo: isDemoTrainer(world, data.id),
      }
    : null;
}

/** Tot el que penja d'un professional i s'ha de resoldre en donar-lo de baixa. */
export async function getBaixaImpact(id: string, now = new Date()): Promise<BaixaImpact | null> {
  const professional = await getProfessional(id);
  if (!professional) return null;
  const nowIso = now.toISOString();
  const world = await getDemoWorld();
  const reassignTargets = (await listTrainers())
    .filter((t) => t.id !== id && isDemoTrainer(world, t.id) === professional.isDemo)
    .map((t) => ({ id: t.id, name: t.name }));

  if (USE_MOCK) {
    const store = getStore();
    const clientName = (clientId: string) => {
      const c = store.clients.find((x) => x.id === clientId);
      return store.profiles.find((p) => p.id === c?.profile_id)?.full_name ?? "—";
    };
    return {
      professional,
      clients: store.clients
        .filter((c) => c.assigned_trainer_id === id)
        .map((c) => ({ id: c.id, name: clientName(c.id) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      reservations: store.reservations
        .filter((r) => r.trainer_id === id && r.status === "booked" && r.scheduled_at > nowIso)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
        .map((r) => ({ id: r.id, scheduledAt: r.scheduled_at, serviceType: r.service_type, clientName: clientName(r.client_id) })),
      series: store.booking_series
        .filter((s) => s.base_trainer_id === id && s.status === "active")
        .map((s) => ({ id: s.id, clientName: clientName(s.client_id) })),
      waits: store.waitlist_entries
        .filter((w) => w.trainer_id === id && w.status === "waiting")
        .map((w) => ({
          id: w.id,
          desiredDate: w.desired_date,
          desiredTime: w.desired_time.slice(0, 5),
          serviceType: w.service_type,
          clientName: clientName(w.client_id),
        })),
      trials: store.trial_bookings
        .filter((t) => t.trainer_id === id && ACTIVE_TRIAL.includes(t.status) && t.scheduled_at > nowIso)
        .map((t) => ({ id: t.id, scheduledAt: t.scheduled_at, fullName: t.full_name, status: t.status })),
      reassignTargets,
    };
  }

  const admin = createAdminClient();
  const [cl, res, ser, wai, tri] = await Promise.all([
    admin.from("clients").select("id").eq("assigned_trainer_id", id),
    admin
      .from("reservations")
      .select("id, client_id, scheduled_at, service_type")
      .eq("trainer_id", id)
      .eq("status", "booked")
      .gt("scheduled_at", nowIso)
      .order("scheduled_at"),
    admin.from("booking_series").select("id, client_id").eq("base_trainer_id", id).eq("status", "active"),
    admin
      .from("waitlist_entries")
      .select("id, client_id, desired_date, desired_time, service_type")
      .eq("trainer_id", id)
      .eq("status", "waiting")
      .order("desired_date"),
    admin
      .from("trial_bookings")
      .select("id, full_name, scheduled_at, status")
      .eq("trainer_id", id)
      .in("status", ACTIVE_TRIAL)
      .gt("scheduled_at", nowIso)
      .order("scheduled_at"),
  ]);
  for (const r of [cl, res, ser, wai, tri]) if (r.error) throw r.error;

  // Els noms dels clients, d'una sola consulta.
  const ids = [
    ...new Set([
      ...(cl.data ?? []).map((c) => c.id),
      ...(res.data ?? []).map((r) => r.client_id),
      ...(ser.data ?? []).map((s) => s.client_id),
      ...(wai.data ?? []).map((w) => w.client_id),
    ]),
  ];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data, error } = await admin
      .from("clients")
      .select("id, profile:profiles!clients_profile_id_fkey(full_name)")
      .in("id", ids);
    if (error) throw error;
    for (const c of (data ?? []) as unknown as { id: string; profile: { full_name: string | null } | null }[])
      names.set(c.id, c.profile?.full_name ?? "—");
  }
  const nameOf = (clientId: string) => names.get(clientId) ?? "—";

  return {
    professional,
    clients: (cl.data ?? []).map((c) => ({ id: c.id, name: nameOf(c.id) })).sort((a, b) => a.name.localeCompare(b.name)),
    reservations: (res.data ?? []).map((r) => ({
      id: r.id,
      scheduledAt: r.scheduled_at,
      serviceType: r.service_type,
      clientName: nameOf(r.client_id),
    })),
    series: (ser.data ?? []).map((s) => ({ id: s.id, clientName: nameOf(s.client_id) })),
    waits: (wai.data ?? []).map((w) => ({
      id: w.id,
      desiredDate: w.desired_date,
      desiredTime: w.desired_time.slice(0, 5),
      serviceType: w.service_type,
      clientName: nameOf(w.client_id),
    })),
    trials: (tri.data ?? []).map((t) => ({ id: t.id, scheduledAt: t.scheduled_at, fullName: t.full_name, status: t.status })),
    reassignTargets,
  };
}

export class BaixaError extends Error {}

export type BaixaResult = {
  clientsReassigned: number;
  reservationsCancelled: number;
  seriesClosed: number;
  waitsCancelled: number;
  trialsCancelled: number;
  /** El que no s'ha pogut fer (la baixa s'ha fet igualment). */
  warnings: string[];
};

/**
 * Dona de baixa (desactiva) un professional. Qui crida ja ha comprovat que és
 * l'admin i que el nom escrit coincideix.
 *
 * `reassignTo`: a qui passen els seus clients (null = sense professional). Ha
 * de ser a la llista `reassignTargets`.
 *
 * L'ordre: primer es resol el que en depèn i, al final, es desactiva. Si una
 * passa falla a mig camí, la baixa no es fa i l'admin ho torna a provar: la
 * pantalla tornarà a ensenyar només el que encara quedi.
 */
export async function deactivateProfessional(input: {
  id: string;
  actorId: string;
  reassignTo: string | null;
}): Promise<BaixaResult> {
  const impact = await getBaixaImpact(input.id);
  if (!impact) throw new BaixaError("Professional no trobat.");
  const p = impact.professional;
  if (p.id === input.actorId) throw new BaixaError("No et pots donar de baixa a tu mateix.");
  if (p.role !== "trainer")
    throw new BaixaError("Des d'aquí només es donen de baixa professionals, mai un administrador.");
  if (p.deactivatedAt) throw new BaixaError("Aquest professional ja està donat de baixa.");
  if (input.reassignTo && !impact.reassignTargets.some((t) => t.id === input.reassignTo))
    throw new BaixaError("Tria a qui passen els clients d'entre els professionals actius.");

  const out: BaixaResult = {
    clientsReassigned: 0,
    reservationsCancelled: 0,
    seriesClosed: 0,
    waitsCancelled: 0,
    trialsCancelled: 0,
    warnings: [],
  };

  // 1. Els clients.
  for (const c of impact.clients) {
    await reassignClientTrainer(c.id, input.reassignTo);
    out.clientsReassigned++;
  }

  // 2. Les reserves futures: en nom del centre, una sola transacció.
  if (impact.reservations.length)
    out.reservationsCancelled = (
      await cancelReservationsByCenter(
        p.id,
        impact.reservations.map((r) => r.id),
      )
    ).length;

  // 3. Les sèries: sense ell no se'n pot reservar cap més.
  if (impact.series.length) out.seriesClosed = await closeSeries(impact.series.map((s) => s.id));

  // 4. Les esperes, i l'avís als clients ara mateix (el cron ho repesca si falla).
  out.waitsCancelled = await cancelWaitsOfProfessional(p.id);

  // 5. Les proves: el camí de sempre, que avisa la persona.
  for (const t of impact.trials) {
    try {
      await rejectTrial(t.id, null);
      out.trialsCancelled++;
    } catch {
      out.warnings.push(`No s'ha pogut anul·lar la prova de ${t.fullName}: fes-ho des de «Proves».`);
    }
  }

  // 6. El perfil. Amb la sessió de l'admin: el trigger de la 0128 hi torna a
  //    mirar (només admin, mai un mateix).
  await setDeactivated(p.id, input.actorId);

  // 7. Auth: no pot tornar a entrar. Si falla, la baixa ja hi és (la base i el
  //    middleware ja el deixen fora), però es diu.
  try {
    await setAuthBan(p.id, true);
  } catch {
    out.warnings.push("No s'ha pogut bloquejar l'accés a Auth: torna-ho a provar reactivant-lo i donant-lo de baixa de nou.");
  }

  if (out.waitsCancelled)
    await notifyCancelledWaits().catch(() => {
      out.warnings.push("L'avís de les esperes anul·lades sortirà amb el cron d'aquesta nit.");
    });

  try {
    await logDataAccess({
      actorId: input.actorId,
      subjectProfileId: p.id,
      subjectLabel: `${p.fullName} <${p.email}>`,
      action: "professional_deactivated",
      details:
        `Baixa del professional. Clients: ${out.clientsReassigned} → ${
          input.reassignTo ? (impact.reassignTargets.find((t) => t.id === input.reassignTo)?.name ?? input.reassignTo) : "sense professional"
        }; reserves cancel·lades: ${out.reservationsCancelled}; sèries tancades: ${out.seriesClosed}; ` +
        `esperes anul·lades: ${out.waitsCancelled}; proves anul·lades: ${out.trialsCancelled}.` +
        (out.warnings.length ? ` Avisos: ${out.warnings.join(" ")}` : ""),
    });
  } catch {
    // El registre és best-effort, com a la baixa d'un client.
  }
  return out;
}

/** Reactiva un professional donat de baixa. Els clients i reserves resolts no tornen. */
export async function reactivateProfessional(input: { id: string; actorId: string }): Promise<{ warnings: string[] }> {
  const p = await getProfessional(input.id);
  if (!p) throw new BaixaError("Professional no trobat.");
  if (p.id === input.actorId) throw new BaixaError("No et pots reactivar a tu mateix.");
  if (!p.deactivatedAt) throw new BaixaError("Aquest professional no està donat de baixa.");
  const warnings: string[] = [];
  await setDeactivated(p.id, null);
  try {
    await setAuthBan(p.id, false);
  } catch {
    warnings.push("No s'ha pogut desbloquejar l'accés a Auth: torna-ho a provar.");
  }
  try {
    await logDataAccess({
      actorId: input.actorId,
      subjectProfileId: p.id,
      subjectLabel: `${p.fullName} <${p.email}>`,
      action: "professional_reactivated",
      details: "Reactivat. Torna a poder entrar i la seva disponibilitat es torna a oferir.",
    });
  } catch {
    // Best-effort.
  }
  return { warnings };
}

/** `actorId` null = reactivar. */
async function setDeactivated(id: string, actorId: string | null): Promise<void> {
  const patch = actorId
    ? { deactivated_at: new Date().toISOString(), deactivated_by: actorId }
    : { deactivated_at: null, deactivated_by: null };
  if (USE_MOCK) {
    const store = getStore();
    const p = store.profiles.find((x) => x.id === id);
    if (!p) throw new BaixaError("Professional no trobat.");
    Object.assign(p, patch);
    saveStore(store);
    return;
  }
  const { error, count } = await (await createClient())
    .from("profiles")
    .update(patch, { count: "exact" })
    .eq("id", id);
  if (error) throw error;
  if (count === 0) throw new BaixaError("No s'ha pogut canviar el perfil (permís).");
}

/** Bloqueja (o desbloqueja) l'accés a Auth. Bloquejat, no pot renovar la sessió. */
async function setAuthBan(id: string, banned: boolean): Promise<void> {
  if (USE_MOCK) return;
  const { error } = await createAdminClient().auth.admin.updateUserById(id, {
    // «Per sempre» a efectes pràctics (100 anys); «none» el treu.
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) throw error;
}

async function closeSeries(ids: string[]): Promise<number> {
  if (USE_MOCK) {
    const store = getStore();
    let n = 0;
    for (const s of store.booking_series)
      if (ids.includes(s.id) && s.status === "active") {
        s.status = "cancelled";
        n++;
      }
    saveStore(store);
    return n;
  }
  const { data, error } = await createAdminClient()
    .from("booking_series")
    .update({ status: "cancelled" })
    .in("id", ids)
    .eq("status", "active")
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
