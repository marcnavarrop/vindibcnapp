import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { isBonoExpired } from "@/lib/data/bonos";
import { centerDateStr } from "@/lib/center-time";
import type { ClientDetail, ClientReservation } from "@/lib/data/clients";

export type TrainerCard = { name: string; avatarPath: string | null };

/**
 * Nom i foto de cada professional, per ensenyar-los al client.
 *
 * Va amb el client de SERVEI a propòsit: la RLS de `profiles` no deixa que un
 * client llegeixi el perfil d'un professional, així que pel camí normal la
 * seva pròpia reserva li sortiria sense nom ni cara. No és cap forat: el
 * calendari de reserva ja li ensenya els noms i les fotos de tot l'equip pel
 * mateix camí —és informació pública del centre—, i aquí només se n'agafa el
 * nom i la ruta de la foto, res més del perfil.
 */
export async function listTrainerCards(): Promise<Map<string, TrainerCard>> {
  const out = new Map<string, TrainerCard>();

  if (USE_MOCK) {
    for (const p of getStore().profiles.filter((x) => x.role === "trainer"))
      out.set(p.id, { name: p.full_name ?? "—", avatarPath: p.avatar_path });
    return out;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, avatar_path")
    .eq("role", "trainer");
  for (const p of data ?? [])
    out.set(p.id, { name: p.full_name ?? "—", avatarPath: p.avatar_path });
  return out;
}

/**
 * Els quatre números de l'inici del client.
 *
 * Es calculen aquí i no a la pàgina perquè són regles de negoci —què compta
 * com a bo actiu, què compta com a assistència— i han de poder-se llegir en un
 * sol lloc. La pàgina només els pinta.
 *
 * No fa cap consulta: parteix del `ClientDetail` que la pàgina ja demana, o
 * sigui que afegir aquests números no costa ni un viatge més a la base.
 */
export type ClientKpis = {
  /** Sessions que li queden i total que va comprar, sobre els bons vigents. */
  remainingSessions: number;
  totalSessions: number;
  activeBonos: number;
  /** Reserves confirmades dins dels pròxims 7 dies. */
  upcomingWeek: number;
  /**
   * Percentatge d'assistència del mes en curs, o `null` si encara no hi ha
   * cap sessió tancada per mesurar-la.
   */
  attendancePct: number | null;
  attendanceDone: number;
  attendanceTotal: number;
};

/** Dies que mira la targeta de "properes reserves". */
export const UPCOMING_DAYS = 7;

/**
 * Bons que compten com a actius.
 *
 * Els mateixos que a la resta de l'app: actiu o pendent de pagament (un bo
 * pendent ja es pot fer servir per reservar) i no caducat, perquè la data mana
 * sobre l'estat desat.
 */
export function usableBonos(client: ClientDetail) {
  return client.bonos.filter(
    (b) =>
      (b.status === "active" || b.status === "pending_payment") &&
      !isBonoExpired({ status: b.status, expires_at: b.expiresAt }),
  );
}

/** Reserves confirmades encara per venir, de la més propera a la més llunyana. */
export function upcomingReservations(
  client: ClientDetail,
  nowISO: string,
): ClientReservation[] {
  return client.reservations
    .filter((r) => r.status === "booked" && r.scheduledAt >= nowISO)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function computeClientKpis(
  client: ClientDetail,
  now: Date = new Date(),
): ClientKpis {
  const nowISO = now.toISOString();
  const bonos = usableBonos(client);

  const upcoming = upcomingReservations(client, nowISO);
  const weekLimit = new Date(
    now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // ── Assistència del mes ──
  // Criteri: de les sessions del mes que ja tenen un desenllaç —fetes o
  // anul·lades—, quantes es van fer. Les que segueixen com a 'booked' no hi
  // entren: o encara no han arribat, o ningú les ha tancades, i en cap dels
  // dos casos diuen res sobre si el client hi va anar.
  // Es compara pel mes del CENTRE, no pel del procés.
  const monthPrefix = centerDateStr(now).slice(0, 7); // YYYY-MM
  const thisMonth = client.reservations.filter(
    (r) => centerDateStr(new Date(r.scheduledAt)).startsWith(monthPrefix),
  );
  const done = thisMonth.filter((r) => r.status === "completed").length;
  const settled =
    done + thisMonth.filter((r) => r.status === "cancelled").length;

  return {
    remainingSessions: bonos.reduce((s, b) => s + b.remainingSessions, 0),
    totalSessions: bonos.reduce((s, b) => s + b.totalSessions, 0),
    activeBonos: bonos.length,
    upcomingWeek: upcoming.filter((r) => r.scheduledAt <= weekLimit).length,
    attendancePct: settled > 0 ? Math.round((done / settled) * 100) : null,
    attendanceDone: done,
    attendanceTotal: settled,
  };
}
