import "server-only";
import { createClient } from "@/lib/supabase/server";
import { USE_MOCK } from "@/lib/config";
import { getStore } from "@/lib/mock/store";
import type { BonoStatus, ServiceType } from "@/types/database";

/**
 * EL QUE LA FITXA D'UNA RESERVA DEMANA EN OBRIR-SE.
 *
 * La reserva en si (client, hora, servei, professional, estat) ja la té el
 * calendari. Això és el que NO té i que abans calia anar a buscar a la fitxa del
 * client: el telèfon, el bo del qual surt, la sèrie i la propera sessió. Es
 * demana en obrir, d'una en una, perquè carregar-ho per a totes les reserves de
 * la setmana seria pagar per mirar el que gairebé ningú no obre.
 *
 * ELS PERMISOS SÓN ELS D'AVUI
 *
 * Tot va pel client de SERVIDOR amb la sessió de qui mira, mai per la clau de
 * servei: el que torna ho decideix la RLS, igual que a la fitxa del client.
 *
 *   · telèfon: `profiles_select` (0006) — l'admin i qualsevol professional;
 *   · bo: `bonos_select` (0005) — l'admin i qualsevol professional;
 *   · reserves (sèrie i propera): `reservations_select` (0005), el mateix.
 *
 * La SÈRIE surt de les reserves que comparteixen `series_id`, i no de
 * `booking_series`: aquella taula només la llegeixen l'admin i el client
 * (0049), i obrir-la als professionals seria un canvi de permisos que aquesta
 * fitxa no ha de fer. Amb les reserves n'hi ha prou per dir «sessió 3 de 8».
 */
export type ReservationDetail = {
  phone: string | null;
  bono: {
    serviceType: ServiceType;
    remainingSessions: number;
    totalSessions: number;
    status: BonoStatus;
    expiresAt: string | null;
  } | null;
  /** Posició d'aquesta reserva entre les no cancel·lades de la seva sèrie. */
  series: { position: number; total: number } | null;
  /**
   * La propera sessió reservada del client: després d'aquesta i, si aquesta ja
   * ha passat, després d'ara (una de passada sense marcar no és "propera").
   */
  next: {
    scheduledAt: string;
    serviceType: ServiceType;
    trainerName: string | null;
  } | null;
};

type Row = {
  id: string;
  client_id: string;
  bono_id: string | null;
  series_id: string | null;
  scheduled_at: string;
  status: string;
};

function seriesOf(rows: { id: string; status: string }[], id: string) {
  const live = rows.filter((r) => r.status !== "cancelled");
  const i = live.findIndex((r) => r.id === id);
  return i < 0 ? null : { position: i + 1, total: live.length };
}

/**
 * L'instant més tardà entre aquest i ara, en ISO amb `Z`. Es compara com a
 * data i no com a text: Supabase torna `+00:00` i el mock, `Z`.
 */
function laterOf(iso: string): string {
  return new Date(Math.max(new Date(iso).getTime(), Date.now())).toISOString();
}

export async function getReservationDetail(
  id: string,
): Promise<ReservationDetail | null> {
  if (USE_MOCK) {
    const s = getStore();
    const r = s.reservations.find((x) => x.id === id);
    if (!r) return null;
    const client = s.clients.find((c) => c.id === r.client_id);
    const profile = s.profiles.find((p) => p.id === client?.profile_id);
    const bono = r.bono_id ? s.bonos.find((b) => b.id === r.bono_id) : null;
    const series = r.series_id
      ? seriesOf(
          s.reservations
            .filter((x) => x.series_id === r.series_id)
            .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
          r.id,
        )
      : null;
    const after = laterOf(r.scheduled_at);
    const next = s.reservations
      .filter(
        (x) =>
          x.client_id === r.client_id &&
          x.status === "booked" &&
          x.scheduled_at > after,
      )
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
    return {
      phone: profile?.phone ?? null,
      bono: bono
        ? {
            serviceType: bono.service_type,
            remainingSessions: bono.remaining_sessions,
            totalSessions: bono.total_sessions,
            status: bono.status,
            expiresAt: bono.expires_at ?? null,
          }
        : null,
      series,
      next: next
        ? {
            scheduledAt: next.scheduled_at,
            serviceType: next.service_type,
            trainerName:
              s.profiles.find((p) => p.id === next.trainer_id)?.full_name ?? null,
          }
        : null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id, client_id, bono_id, series_id, scheduled_at, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Row;

  const [client, bono, series, next] = await Promise.all([
    supabase
      .from("clients")
      .select("profile:profiles!clients_profile_id_fkey(phone)")
      .eq("id", r.client_id)
      .maybeSingle(),
    r.bono_id
      ? supabase
          .from("bonos")
          .select("service_type, remaining_sessions, total_sessions, status, expires_at")
          .eq("id", r.bono_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    r.series_id
      ? supabase
          .from("reservations")
          .select("id, status")
          .eq("series_id", r.series_id)
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("reservations")
      .select(
        "scheduled_at, service_type, trainer:profiles!reservations_trainer_id_fkey(full_name)",
      )
      .eq("client_id", r.client_id)
      .eq("status", "booked")
      .gt("scheduled_at", laterOf(r.scheduled_at))
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const q of [client, bono, series, next]) if (q.error) throw q.error;

  const phone =
    (client.data as { profile: { phone: string | null } | null } | null)?.profile
      ?.phone ?? null;
  const b = bono.data as {
    service_type: ServiceType;
    remaining_sessions: number;
    total_sessions: number;
    status: BonoStatus;
    expires_at: string | null;
  } | null;
  const n = next.data as {
    scheduled_at: string;
    service_type: ServiceType;
    trainer: { full_name: string | null } | null;
  } | null;
  return {
    phone,
    bono: b
      ? {
          serviceType: b.service_type,
          remainingSessions: b.remaining_sessions,
          totalSessions: b.total_sessions,
          status: b.status,
          expiresAt: b.expires_at,
        }
      : null,
    series: series.data
      ? seriesOf(series.data as { id: string; status: string }[], r.id)
      : null,
    next: n
      ? {
          scheduledAt: n.scheduled_at,
          serviceType: n.service_type,
          trainerName: n.trainer?.full_name ?? null,
        }
      : null,
  };
}
