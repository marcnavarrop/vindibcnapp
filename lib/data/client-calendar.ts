import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { listAllTrainerRulesLite } from "@/lib/data/availability";
import { listAllBlocksLite } from "@/lib/data/availability-blocks";
import { listActiveTrialHolds } from "@/lib/data/trial-bookings";
import { isBonoExpired } from "@/lib/data/bonos";
import { avatarUrls } from "@/lib/data/avatars";
import type { TrainerRuleLite, TrainerBlockLite } from "@/lib/availability-slots";
import type { ServiceType, ReservationStatus } from "@/types/database";

/**
 * Reserva del centre per al calendari del client.
 *
 * Les reserves d'altres persones arriben ANÒNIMES: aquest tipus no té camp de
 * nom... amb UNA excepció acotada, `mateName`.
 */
export type CenterReservation = {
  id: string;
  trainerId: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
  isOwn: boolean;
  /**
   * Nom de pila de qui té la reserva, NOMÉS si és de 'grupo_reducido'.
   *
   * A una classe de grup et trobes físicament els companys: amagar-ne el nom
   * no protegeix res i només fa la pantalla més pobra. A qualsevol altre
   * servei —individual o parelles— això val `null` i no surt del servidor,
   * perquè allà sí que hi ha una expectativa raonable de discreció: qui va al
   * fisioterapeuta o a una sessió individual no ho està ensenyant a ningú.
   *
   * L'exclusió es fa AQUÍ, en projectar, i no al component: així el nom no
   * arriba mai al navegador per als serveis que no toca, per molt que després
   * algú es descuidi de filtrar-lo a la vista.
   */
  mateName: string | null;
};

/** Del nom complet al nom de pila: és l'únic tros que es publica. */
function firstName(full: string | null | undefined): string | null {
  const n = (full ?? "").trim();
  return n ? n.split(/\s+/)[0] : null;
}

/** El nom només viatja si la reserva és de grup. Punt únic de decisió. */
function mateNameFor(
  serviceType: ServiceType,
  fullName: string | null | undefined,
): string | null {
  return serviceType === "grupo_reducido" ? firstName(fullName) : null;
}

export type ClientCenterData = {
  clientId: string | null;
  /** Entrenador assignat al client (pot ser null si no en té cap). */
  assignedTrainerId: string | null;
  /** Tipos de servicio que el cliente puede reservar (bonos activos con sesiones). */
  bonoTypes: ServiceType[];
  trainers: { id: string; name: string; avatarUrl: string | null }[];
  rules: TrainerRuleLite[];
  /** Bloquejos temporals que tapen les regles setmanals. */
  blocks: TrainerBlockLite[];
  reservations: CenterReservation[];
};

const EMPTY: ClientCenterData = {
  clientId: null,
  assignedTrainerId: null,
  bonoTypes: [],
  trainers: [],
  rules: [],
  blocks: [],
  reservations: [],
};

/**
 * Datos para el calendario GLOBAL del cliente: la disponibilidad de todos los
 * profesionales, los tipos de bono activos del cliente (lo que determina qué
 * puede reservar) y la ocupación (anonimizada). La anonimización se hace aquí.
 */
export async function getClientCenterData(
  profileId: string,
): Promise<ClientCenterData> {
  // Les proves 'pending'/'confirmed' ocupen el forat: es mostren com a
  // reserves anònimes ('booked', isOwn=false) perquè el client no pugui
  // reservar-hi a sobre ni deduir de qui són.
  //
  // S'engega aquí però NO s'espera encara: no depèn de res del client, així
  // que ha de viatjar en paral·lel amb la consulta de `clients` en comptes
  // d'encadenar-s'hi (eren dos viatges de xarxa seguits).
  const holdsPromise = listActiveTrialHolds();
  const toHoldReservations = (
    holds: Awaited<typeof holdsPromise>,
  ): CenterReservation[] =>
    holds.map((h) => ({
      id: `trial-${h.id}`,
      trainerId: h.trainerId,
      scheduledAt: h.scheduledAt,
      serviceType: h.serviceType,
      status: "booked" as ReservationStatus,
      isOwn: false,
      // Una prova encara no és de ningú del centre: cap nom, ni de grup.
      mateName: null,
    }));

  if (USE_MOCK) {
    // En simulació no hi ha latència: s'espera abans de qualsevol return
    // primerenc, perquè la promesa no quedi penjada.
    const holdReservations = toHoldReservations(await holdsPromise);
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === profileId);
    if (!client) return EMPTY;
    const bonoTypes = [
      ...new Set(
        store.bonos
          .filter(
            (b) =>
              b.client_id === client.id &&
              (b.status === "active" || b.status === "pending_payment") &&
              b.remaining_sessions > 0 &&
              // Un bo caducat no habilita res: si no, el calendari oferiria
              // franges que el servidor rebutjaria en intentar reservar-les.
              !isBonoExpired(b),
          )
          .map((b) => b.service_type),
      ),
    ];
    const trainers = store.profiles
      .filter((p) => p.role === "trainer")
      .map((p) => ({ id: p.id, name: p.full_name ?? "—", avatarUrl: null }));
    const rules = store.availability_rules.map((r) => ({
      trainerId: r.trainer_id,
      weekday: r.weekday,
      startHour: parseInt(r.start_time.slice(0, 2), 10),
      endHour: parseInt(r.end_time.slice(0, 2), 10),
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      serviceTypes: r.service_types ?? [],
    }));
    const reservations = store.reservations
      .filter((r) => r.status !== "cancelled")
      .map((r) => {
        const c = store.clients.find((x) => x.id === r.client_id);
        const name = store.profiles.find((p) => p.id === c?.profile_id)?.full_name;
        return {
          id: r.id,
          trainerId: r.trainer_id,
          scheduledAt: r.scheduled_at,
          serviceType: r.service_type,
          status: r.status,
          isOwn: r.client_id === client.id,
          mateName: mateNameFor(r.service_type, name),
        };
      });
    return {
      clientId: client.id,
      assignedTrainerId: client.assigned_trainer_id ?? null,
      bonoTypes,
      trainers,
      rules,
      blocks: await listAllBlocksLite(),
      reservations: [...reservations, ...holdReservations],
    };
  }

  const admin = createAdminClient();
  // Les proves i la fila de client són independents: un sol viatge en comptes
  // de dos encadenats.
  const [holds, { data: client }] = await Promise.all([
    holdsPromise,
    admin
      .from("clients")
      .select("id, assigned_trainer_id")
      .eq("profile_id", profileId)
      .single(),
  ]);
  const holdReservations = toHoldReservations(holds);
  if (!client) return EMPTY;

  const [bonoRows, trainerRows, rules, blocks, resRows] = await Promise.all([
    admin
      .from("bonos")
      .select("service_type, status, remaining_sessions, expires_at")
      .eq("client_id", client.id),
    admin.from("profiles").select("id, full_name, avatar_path").eq("role", "trainer"),
    listAllTrainerRulesLite(),
    listAllBlocksLite(),
    // El nom del client s'incorpora a la consulta, però NOMÉS surt d'aquí per
    // a les reserves de grup (vegeu `mateNameFor`). La consulta va amb el
    // client de servei, com tota la resta d'aquest fitxer: qui decideix què es
    // publica és aquesta projecció, no la RLS.
    admin
      .from("reservations")
      .select(
        `id, client_id, trainer_id, scheduled_at, service_type, status,
         client:clients!reservations_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`,
      )
      .neq("status", "cancelled"),
  ]);

  const bonoTypes = [
    ...new Set(
      (bonoRows.data ?? [])
        .filter(
          (b) =>
            (b.status === "active" || b.status === "pending_payment") &&
            b.remaining_sessions > 0 &&
            !isBonoExpired(b),
        )
        .map((b) => b.service_type),
    ),
  ];
  // Les fotos, totes d'un cop: la llegenda les pinta juntes.
  const avatars = await avatarUrls(
    (trainerRows.data ?? []).map((t) => t.avatar_path),
  );
  const trainers = (trainerRows.data ?? []).map((t) => ({
    id: t.id,
    name: t.full_name ?? "—",
    avatarUrl: avatars.get(t.avatar_path ?? "") ?? null,
  }));
  type ResRow = {
    id: string;
    client_id: string;
    trainer_id: string | null;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    client: { profile: { full_name: string | null } | null } | null;
  };
  const reservations: CenterReservation[] = (
    (resRows.data ?? []) as unknown as ResRow[]
  ).map((r) => ({
    id: r.id,
    trainerId: r.trainer_id,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
    status: r.status,
    isOwn: r.client_id === client.id,
    mateName: mateNameFor(r.service_type, r.client?.profile?.full_name),
  }));

  return {
    clientId: client.id,
    assignedTrainerId: client.assigned_trainer_id ?? null,
    bonoTypes,
    trainers,
    rules,
    blocks,
    reservations: [...reservations, ...holdReservations],
  };
}
