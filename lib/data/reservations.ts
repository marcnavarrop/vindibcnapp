import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { USE_MOCK } from "@/lib/config";
import {
  centerDateStr,
  centerWeekday,
  centerSlot,
  centerToday,
} from "@/lib/center-time";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { mockFails } from "@/lib/mock/faults";
import { listTrainers } from "@/lib/data/clients";
import { listAvailabilityLite } from "@/lib/data/availability";
import { listBlocksLite } from "@/lib/data/availability-blocks";
import {
  isServiceAvailableOn,
  isRangeBlocked,
  rangesOverlap,
  sessionEndIso,
  hourToSlot,
  slotsFor,
  slotToHHMM,
} from "@/lib/availability-slots";
// Només la variant de simulació: als camins reals les proves les compta la
// funció de Postgres que reserva (book_group_slot / book_individual_slot),
// dins del seu pany. Comptar-les també aquí seria una segona opinió sense
// autoritat.
import { mockActiveHoldsAt } from "@/lib/data/trial-bookings";
import { hasRoom } from "@/lib/free-slots";
import { notify, getProfileContact } from "@/lib/notifications";
import { getCenterSettings } from "@/lib/data/center-settings";
import { isBonoExpired } from "@/lib/data/bonos";
import { afterBonoConsumed } from "@/lib/data/bono-consumption";
import { GROUP_CAPACITY, SESSION_DURATION_MINUTES } from "@/lib/labels";
import { canRepeatInSeries } from "@/lib/series-rules";
import { getViewer } from "@/lib/auth";
import type {
  Database,
  ServiceType,
  ReservationStatus,
  BonoStatus,
  CenterCancellationRow,
  CancelReservationResult,
} from "@/types/database";
import { canCancelAt, TooLateToCancelError } from "@/lib/cancellation";

/**
 * Lanza si la franja no cae dentro de la disponibilidad del trainer para el servicio.
 *
 * SENSE PROFESSIONAL ES COMPROVA L'HORARI DEL CENTRE, NO RES
 *
 * Deia que amb `trainerId` nul "no hi ha res a comprovar", i era mig cert: no
 * trepitja l'horari de ningú. Però "de ningú" es va llegir com "de res", i
 * «Sense assignar» —que és el valor per DEFECTE del desplegable— es saltava
 * tota validació d'hora. Una reserva a les tres de la matinada entrava sense
 * dir res.
 *
 * Amb professional mana la seva disponibilitat, que és la regla concreta i
 * escrita a mà. Sense professional no hi ha cap regla d'aquestes, i l'única
 * cosa que queda per comprovar és l'horari del CENTRE: de l'obertura al
 * tancament, i amb la sessió sencera a dins.
 *
 * Es fa NOMÉS en aquest cas i no per a tothom. Les regles de disponibilitat
 * no estan acotades per l'horari del centre (`parseCommon` mira l'ordre i la
 * durada mínima, res més), o sigui que aplicar-lo a tothom podria rebutjar una
 * regla escrita a posta. La idea es llegeix així: tota reserva es comprova
 * contra un horari, i quin horari depèn de si hi ha professional.
 *
 * L'aritmètica és la mateixa que fa servir `booking-series.ts` per acotar les
 * alternatives —l'última entrada possible és el tancament menys una sessió—
 * perquè les dues bandes diguin el mateix.
 */
async function assertWithinAvailability(
  trainerId: string | null,
  when: Date,
  serviceType: ServiceType,
): Promise<void> {
  if (!trainerId) {
    const { openingHour, closingHour } = await getCenterSettings();
    const primer = hourToSlot(openingHour);
    // L'última entrada que hi cap sencera: el tancament menys una sessió.
    const ultim = hourToSlot(closingHour) - slotsFor(SESSION_DURATION_MINUTES);
    // En hora del CENTRE. Amb els getters locals del procés, a Vercel —que va
    // en UTC— una sessió de les 10 d'aquí es comprovaria contra les 8.
    const slot = centerSlot(when);
    if (slot < primer || slot > ultim)
      throw new Error(
        `Sense professional assignat, la reserva ha de ser dins de l'horari del ` +
          `centre: de ${slotToHHMM(primer)} a ${slotToHHMM(hourToSlot(closingHour))} ` +
          `(l'última entrada és a les ${slotToHHMM(ultim)}).`,
      );
    return;
  }
  const [rules, blocks] = await Promise.all([
    listAvailabilityLite(trainerId),
    listBlocksLite(trainerId),
  ]);
  // Les regles estan escrites en hora del centre. En comptes de passar un Date
  // i confiar que els getters locals del procés donin els valors del centre
  // —cert només mentre el servidor corri en UTC—, se li donen el dia, el dia
  // de la setmana i l'hora ja resolts.
  if (
    !isServiceAvailableOn(
      rules,
      centerDateStr(when),
      centerWeekday(when),
      centerSlot(when),
      serviceType,
      SESSION_DURATION_MINUTES,
    )
  )
    throw new Error(
      "Aquesta franja no està dins de la disponibilitat d'aquest professional per a aquest servei.",
    );

  // Els bloquejos són instants absoluts: es comparen amb el `when` real, sense
  // passar per toLocalDate (si no, es desplaçarien una o dues hores).
  //
  // Per SOLAPAMENT amb la sessió sencera, no només a l'instant d'inici. Abans
  // una sessió de 12:00 a 13:00 es podia reservar amb un bloqueig des de les
  // 12:30, i el calendari del client —que ja mirava el solapament— no l'oferia.
  // És el mateix criteri que `isSessionCovered`.
  if (
    isRangeBlocked(
      blocks,
      when.getTime(),
      when.getTime() + SESSION_DURATION_MINUTES * 60_000,
    )
  )
    throw new Error(
      "Aquest professional té un bloqueig de disponibilitat en aquesta franja.",
    );
}

type DB = SupabaseClient<Database>;

// ─────────────── Notificacions (best-effort) ───────────────

type Contact = {
  profileId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
};

/** Contacte del client (perfil) a partir del client_id. */
async function clientContact(clientId: string): Promise<Contact | null> {
  if (USE_MOCK) {
    const store = getStore();
    const cl = store.clients.find((c) => c.id === clientId);
    if (!cl) return null;
    const p = store.profiles.find((x) => x.id === cl.profile_id);
    return {
      profileId: cl.profile_id,
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      name: p?.full_name ?? null,
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select(
      "profile_id, profile:profiles!clients_profile_id_fkey(email, phone, full_name)",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;
  const p = (
    data as unknown as {
      profile: { email: string | null; phone: string | null; full_name: string | null } | null;
    }
  ).profile;
  return {
    profileId: data.profile_id as string,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    name: p?.full_name ?? null,
  };
}

/** Notifica al client una reserva creada/cancel·lada (best-effort). */
async function notifyReservation(
  clientId: string,
  type: "reservation_confirmed" | "reservation_cancelled",
  info: {
    reservationId?: string | null;
    scheduledAt: string;
    serviceType: ServiceType;
    trainerName?: string | null;
    /** L'ha cancel·lada el centre en tancar disponibilitat (0090). */
    byCenter?: boolean;
    /**
     * Què ha passat amb la sessió: tornada al bo, tornada a un bo ja caducat
     * (no es podrà fer servir, i el correu no ho promet), o cap (cortesia).
     */
    refund?: "bono" | "expired" | "none";
  },
): Promise<void> {
  const c = await clientContact(clientId);
  if (!c) return;
  await notify(
    {
      type,
      recipient: c,
      relatedId: info.reservationId ?? null,
      data: {
        name: c.name ?? "",
        whenIso: info.scheduledAt,
        serviceType: info.serviceType,
        ...(info.trainerName ? { trainer: info.trainerName } : {}),
        ...(info.byCenter ? { byCenter: "1" } : {}),
        ...(info.refund ? { refund: info.refund } : {}),
      },
    },
    /*
     * Els dos avisos surten d'aquí, però només un és obligatori.
     *
     * Una reserva que existeix la pot veure a l'app quan vulgui; una que ja no
     * existeix, no. Per això la cancel·lació no es pot apagar i la confirmació
     * sí —que a més és, de bon tros, la de més volum.
     */
    { ignorePreferences: type === "reservation_cancelled" },
  );
}

/**
 * Avisa el PROFESSIONAL (dueño de la agenda) que un client li ha reservat o
 * cancel·lat una sessió. Només s'ha de cridar quan l'acció l'ha iniciat el
 * client (autoservei), mai quan l'ha fet el propi entrenador o l'admin.
 */
async function notifyTrainerBooking(
  trainerId: string,
  type: "trainer_booking_received" | "trainer_booking_cancelled",
  info: { clientName: string | null; scheduledAt: string; serviceType: ServiceType },
): Promise<void> {
  const t = await getProfileContact(trainerId);
  if (!t) return;
  await notify({
    type,
    recipient: t,
    data: {
      name: t.name ?? "",
      client: info.clientName ?? "Un client",
      whenIso: info.scheduledAt,
      serviceType: info.serviceType,
    },
  });
}

/**
 * Comprueba que una franja del entrenador esté libre para el servicio dado.
 * Regla: no puede solaparse con otra reserva 'booked' del mismo trainer a la
 * misma hora, EXCEPTO 'grupo_reducido', que admite hasta GROUP_CAPACITY (y solo
 * si no hay ya una sesión individual ocupando la franja). Lanza si está ocupada.
 */
export function slotHasRoom(
  existing: { service_type: ServiceType }[],
  newService: ServiceType,
): boolean {
  // La regla viu a lib/free-slots.ts perquè les pantalles que ofereixen forats
  // facin servir exactament la mateixa: el que diuen lliure és el que aquí passa.
  return hasRoom(existing.map((e) => ({ serviceType: e.service_type })), newService);
}

function assertSlotFree(
  existing: { service_type: ServiceType }[],
  newService: ServiceType,
): void {
  if (newService === "grupo_reducido") {
    const hasExclusive = existing.some(
      (e) => e.service_type !== "grupo_reducido",
    );
    if (hasExclusive) throw new Error("Aquesta franja ja està ocupada.");
    if (existing.length >= GROUP_CAPACITY)
      throw new Error("El grup d'aquesta franja ja està complet.");
  } else if (existing.length > 0) {
    throw new Error("Aquesta franja ja està ocupada.");
  }
}

/**
 * Final (exclòs) d'una fila de reserva, en mil·lisegons.
 *
 * `duration_minutes` es llegeix amb un valor de reserva a posta: al mode
 * simulació hi pot haver un fitxer desat per una versió anterior a la 0082, i
 * una durada indefinida convertiria tota la comparació en NaN —que no falla,
 * simplement deixa de veure ocupants—. A la base la columna és NOT NULL.
 */
const rowEndMs = (r: {
  scheduled_at: string;
  duration_minutes?: number | null;
}): number =>
  new Date(r.scheduled_at).getTime() +
  (r.duration_minutes ?? SESSION_DURATION_MINUTES) * 60_000;

/**
 * Qui ocupa la franja [scheduledAt, +durationMinutes) d'aquest professional.
 *
 * Abans de la 0082 això era una igualtat: `scheduled_at === scheduledAt`. Era
 * cert només mentre totes les sessions comencessin en punt. Dues sessions d'una
 * hora que comencen a les 9:00 i a les 9:30 tenen instants diferents i es
 * trepitgen mitja hora, i la igualtat no en veia cap de les dues.
 *
 * Inclou les de GRUP: una sessió individual no pot entrar on ja hi ha un grup,
 * encara que només el solapi en part.
 */
export function mockOccupants(
  store: Store,
  trainerId: string | null,
  scheduledAt: string,
  durationMinutes: number,
): { service_type: ServiceType; client_id: string }[] {
  if (!trainerId) return [];
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMinutes * 60_000;
  return store.reservations
    .filter(
      (r) =>
        r.trainer_id === trainerId &&
        r.status === "booked" &&
        rangesOverlap(start, end, new Date(r.scheduled_at).getTime(), rowEndMs(r)),
    )
    .map((r) => ({ service_type: r.service_type, client_id: r.client_id }));
}

/** El bessó de `mockOccupants` contra el backend real. */
export async function fetchOccupants(
  db: DB,
  trainerId: string | null,
  scheduledAt: string,
  durationMinutes: number,
): Promise<{ service_type: ServiceType; client_id: string }[]> {
  if (!trainerId) return [];
  // `ends_at` el manté el trigger de la 0082, així que el solapament es pregunta
  // amb dues comparacions indexables i sense aritmètica per fila.
  const { data, error } = await db
    .from("reservations")
    .select("service_type, client_id")
    .eq("trainer_id", trainerId)
    .eq("status", "booked")
    .lt("scheduled_at", sessionEndIso(scheduledAt, durationMinutes))
    .gt("ends_at", scheduledAt);
  if (error) throw error;
  return (data ?? []) as { service_type: ServiceType; client_id: string }[];
}

export type ReservationListItem = {
  id: string;
  clientId: string;
  clientName: string;
  trainerId: string | null;
  trainerName: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
  /**
   * Sessió de cortesia (0070). Aquest tipus el consumeixen NOMÉS les vistes
   * d'admin i professional —el calendari setmanal, l'agenda i els llistats—;
   * l'àrea de client té la seva pròpia forma. Per això el distintiu no pot
   * arribar-li al client per accident.
   */
  isComplimentary: boolean;
};

function nameOfClient(clientId: string, store: Store): string {
  const client = store.clients.find((c) => c.id === clientId);
  const profile = store.profiles.find((p) => p.id === client?.profile_id);
  return profile?.full_name ?? "—";
}

function nameOfProfile(profileId: string | null, store: Store): string | null {
  if (!profileId) return null;
  return store.profiles.find((p) => p.id === profileId)?.full_name ?? null;
}

/**
 * Com es demanen les reserves per a les pantalles de l'equip.
 *
 * NO HI HA "TOTES". Abans `listReservations()` portava tot l'històric del
 * centre, i la base talla cada resposta a `SUPABASE_MAX_ROWS` (1000) sense
 * dir-ho: en ordre ascendent, el que hauria desaparegut primer són les
 * reserves més noves, les futures incloses. Ara qui crida ha de dir quina
 * finestra vol (`from`/`to`) o quantes en vol (`limit`).
 */
type ReservationQuery = {
  /** Inici inclòs (instant real). */
  from?: Date;
  /** Final exclòs (instant real). */
  to?: Date;
  /** Només les d'aquesta agenda. */
  trainerId?: string;
  /** Només aquest estat. */
  status?: ReservationStatus;
  /** Quantes, com a molt, en ordre de data. */
  limit?: number;
};

async function queryReservations(q: ReservationQuery): Promise<ReservationListItem[]> {
  if (mockFails("reservations")) throw new Error("error simulat (MOCK_FAIL=reservations)");
  if (USE_MOCK) {
    const store = getStore();
    const from = q.from?.toISOString();
    const to = q.to?.toISOString();
    const list = store.reservations
      .filter(
        (r) =>
          (!q.trainerId || r.trainer_id === q.trainerId) &&
          (!q.status || r.status === q.status) &&
          (!from || r.scheduled_at >= from) &&
          (!to || r.scheduled_at < to),
      )
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, q.limit ?? Infinity);
    return list.map((r) => ({
      id: r.id,
      clientId: r.client_id,
      clientName: nameOfClient(r.client_id, store),
      trainerId: r.trainer_id,
      trainerName: nameOfProfile(r.trainer_id, store),
      scheduledAt: r.scheduled_at,
      serviceType: r.service_type,
      status: r.status,
      isComplimentary: r.is_complimentary,
    }));
  }

  const supabase = await createClient();
  let query = supabase
    .from("reservations")
    .select(
      `id, client_id, scheduled_at, service_type, status, trainer_id, is_complimentary,
       client:clients!reservations_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name)),
       trainer:profiles!reservations_trainer_id_fkey(full_name)`,
    )
    .order("scheduled_at", { ascending: true });
  if (q.from) query = query.gte("scheduled_at", q.from.toISOString());
  if (q.to) query = query.lt("scheduled_at", q.to.toISOString());
  if (q.trainerId) query = query.eq("trainer_id", q.trainerId);
  if (q.status) query = query.eq("status", q.status);
  if (q.limit) query = query.limit(q.limit);

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    client_id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    trainer_id: string | null;
    is_complimentary: boolean;
    client: { profile: { full_name: string | null } | null } | null;
    trainer: { full_name: string | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client?.profile?.full_name ?? "—",
    trainerId: r.trainer_id,
    trainerName: r.trainer?.full_name ?? null,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
    status: r.status,
    isComplimentary: r.is_complimentary,
  }));
}

/**
 * Les reserves d'una finestra de temps: `[from, to)`. Si es passa `trainerId`,
 * només les d'aquella agenda — i el filtre va A LA CONSULTA, no després, perquè
 * la finestra sigui la mateixa per a qui només veu la seva.
 */
export async function listReservationsInRange(input: {
  from: Date;
  to: Date;
  trainerId?: string;
}): Promise<ReservationListItem[]> {
  return queryReservations(input);
}

/** Les pròximes reserves actives, com a molt `limit`. Per a l'inici del professional. */
export async function listUpcomingReservations(input: {
  limit: number;
  trainerId?: string;
}): Promise<ReservationListItem[]> {
  return queryReservations({
    from: new Date(),
    status: "booked",
    limit: input.limit,
    trainerId: input.trainerId,
  });
}

// ─────────────────────────── Escritura ───────────────────────────

/** Datos para el formulario de nueva reserva: clientes con sus bonos
 *  disponibles (activos y con sesiones) y la lista de entrenadores. */
export type ReservationFormData = {
  clients: {
    id: string;
    name: string;
    bonos: { id: string; serviceType: ServiceType; remaining: number }[];
  }[];
  trainers: { id: string; name: string }[];
};

export async function getReservationFormData(
  onlyTrainerId?: string,
): Promise<ReservationFormData> {
  const trainers = await listTrainers();

  if (USE_MOCK) {
    const store = getStore();
    const clients = store.clients
      .filter((c) => !onlyTrainerId || c.assigned_trainer_id === onlyTrainerId)
      .map((c) => {
      const profile = store.profiles.find((p) => p.id === c.profile_id);
      return {
        id: c.id,
        name: profile?.full_name ?? "—",
        bonos: store.bonos
          .filter(
            (b) =>
              b.client_id === c.id &&
              (b.status === "active" || b.status === "pending_payment") &&
              b.remaining_sessions > 0,
          )
          .map((b) => ({
            id: b.id,
            serviceType: b.service_type,
            remaining: b.remaining_sessions,
          })),
      };
    });
    return { clients, trainers };
  }

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select(
      `id,
       profile:profiles!clients_profile_id_fkey(full_name),
       bonos(id, service_type, remaining_sessions, status)`,
    )
    .order("created_at", { ascending: true });
  if (onlyTrainerId) query = query.eq("assigned_trainer_id", onlyTrainerId);
  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    profile: { full_name: string | null } | null;
    bonos: {
      id: string;
      service_type: ServiceType;
      remaining_sessions: number;
      status: string;
    }[];
  };
  const clients = (data as unknown as Row[]).map((c) => ({
    id: c.id,
    name: c.profile?.full_name ?? "—",
    bonos: c.bonos
      .filter((b) => (b.status === "active" || b.status === "pending_payment") && b.remaining_sessions > 0)
      .map((b) => ({
        id: b.id,
        serviceType: b.service_type,
        remaining: b.remaining_sessions,
      })),
  }));
  return { clients, trainers };
}

/**
 * Què fa falta per crear una reserva des del panell.
 *
 * És una unió i no un objecte amb camps opcionals a posta: amb bo, el client i
 * el tipus de servei SURTEN del bo i no s'han de poder contradir; sense bo
 * —una sessió de cortesia— no hi ha d'on treure'ls i han de venir tots dos.
 * El tipus obliga a dir-ho, en comptes de deixar-ho a un `if` que algú pugui
 * oblidar.
 */
export type ReservationInput = {
  trainerId: string | null;
  scheduledAt: string; // ISO
} & (
  | { bonoId: string; clientId?: undefined; serviceType?: undefined }
  | {
      /** Sessió de cortesia: gratuïta i sense consumir cap bo. */
      bonoId: null;
      clientId: string;
      serviceType: ServiceType;
    }
);

/**
 * Les places de grup que crea l'admin o el professional, una per data.
 *
 * Va per `book_group_slot` com la reserva del client: comptar i inserir des de
 * l'aplicació és una cursa, i un grup no es pot protegir amb un índex únic.
 *
 * Dues coses que aquest camí ha de resoldre i el del client no:
 *
 * 1. LA FUNCIÓ NOMÉS LA POT CRIDAR EL SERVICE_ROLE, i aquest camí s'autoritzava
 *    fins ara amb la RLS del client de sessió (`reservations_trainer_write`).
 *    En passar per la clau de servei, aquella comprovació desapareix i s'ha de
 *    tornar a fer aquí a mà: admin, o el professional assignat a aquest client.
 *    És exactament la mateixa condició que la política, escrita en TypeScript.
 *
 * 2. Amb `repeatWeeks` hi ha diverses dates i la funció en reserva una cada
 *    cop. Si la tercera setmana ja és plena, es desfan les dues primeres: fins
 *    ara l'INSERT de N files era tot o res, i no té sentit que ara et quedin
 *    dues setmanes soltes d'una petició de cinc.
 *
 * Torna les sessions que queden al bo.
 */
/**
 * Qui pot crear una reserva per a aquest client des del camí manual.
 *
 * Aquesta comprovació existeix perquè els dos camins manuals —grup i
 * individual— escriuen amb la clau de SERVEI, que se salta la RLS. La RLS ja no
 * hi és per aturar ningú, així que el permís s'ha de mirar aquí: admin sempre;
 * professional, només si el client és seu.
 *
 * Abans vivia dins de `createGroupReservations`. Quan la individual va passar
 * també per una funció de Postgres (0084) va deixar d'estar protegida per la
 * RLS del client de sessió, i duplicar la comprovació era convidar-les a
 * separar-se amb el temps.
 */
async function assertMayBookFor(clientId: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("No autoritzat.");
  if (viewer.role === "admin") return;
  if (viewer.role !== "trainer") throw new Error("No autoritzat.");
  // Es comprova contra `clientId` i no contra `bono.client_id`: amb cortesia
  // no hi ha bo d'on treure'l. Amb bo, els dos valen el mateix —qui crida
  // passa `bono.client_id`—, així que la comprovació no s'ha afluixat.
  const { data: seu } = await createAdminClient()
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("assigned_trainer_id", viewer.id)
    .maybeSingle();
  if (!seu) throw new Error("Aquest client no és teu.");
}

async function createGroupReservations(
  /**
   * El bo del qual surten les sessions, o `null` si són de cortesia. Quan és
   * null, `clientId` diu de qui és la reserva —amb bo ho diu el bo.
   */
  bono: {
    id: string;
    client_id: string;
    remaining_sessions: number;
    status: BonoStatus;
  } | null,
  clientId: string,
  trainerId: string | null,
  dates: string[],
): Promise<number | null> {
  if (!trainerId)
    throw new Error("Una sessió de grup necessita un professional.");

  // El permís el mira `createReservation` abans de triar camí, un sol cop per a
  // les dues funcions. Aquí ja no es repeteix: era una consulta de més per cada
  // reserva que feia un professional.

  const admin = createAdminClient();
  const fetes: string[] = [];
  let restant = bono ? bono.remaining_sessions : null;

  for (const scheduledAt of dates) {
    const { data: res, error } = await admin.rpc("book_group_slot", {
      p_client_id: clientId,
      // Sense bo, la funció de la 0070 se salta el descompte i marca la fila
      // com a cortesia. El lock i l'aforament segueixen igual.
      p_bono_id: bono ? bono.id : null,
      p_expected_remaining: restant,
      p_trainer_id: trainerId,
      p_scheduled_at: scheduledAt,
      p_capacity: GROUP_CAPACITY,
      p_duration_minutes: SESSION_DURATION_MINUTES,
    });

    if (error || !res || !res.ok) {
      // Desfem el que hagi entrat: la petició era d'N setmanes o cap.
      if (fetes.length > 0)
        await admin.from("reservations").delete().in("id", fetes);
      // Restaurar el comptador només si n'hi havia. Una cortesia no n'ha tocat cap.
      if (bono)
        await admin
          .from("bonos")
          .update({
            remaining_sessions: bono.remaining_sessions,
            status: bono.status,
          })
          .eq("id", bono.id);
      if (error) throw new Error("No s'ha pogut crear la reserva.");
      const motiu = res && !res.ok ? res.reason : null;
      if (motiu === "taken")
        throw new Error("Aquesta franja ja està ocupada.");
      if (motiu === "no_sessions")
        throw new Error("Aquest bo no té sessions disponibles.");
      throw new Error("El grup d'aquesta franja ja està complet.");
    }

    fetes.push(res.id);
    // Amb cortesia la funció torna `remaining: null`: no hi ha comptador que
    // seguir, i el següent cicle ha de tornar a enviar null.
    restant = bono ? res.remaining : null;
  }

  return restant;
}

/**
 * Reserves que NO són de grup, una per data, per `book_individual_slot` (0084).
 *
 * Espill de `createGroupReservations`, i per la mateixa raó: entre el SELECT
 * que mirava si la franja estava lliure i l'INSERT no hi havia res, i una
 * reserva individual que trepitja un grup no la pot aturar la constraint de la
 * 0082 —les files de grup en queden fora a posta—. Ara les dues funcions
 * agafen el MATEIX pany per professional, així que es veuen l'una a l'altra.
 *
 * Tot o res, com a la de grup: si una de les N setmanes no hi cap, s'esborra
 * el que hagi entrat i es torna el comptador del bo on estava.
 */
async function createIndividualReservations(
  bono: {
    id: string;
    client_id: string;
    remaining_sessions: number;
    status: BonoStatus;
  } | null,
  clientId: string,
  trainerId: string | null,
  serviceType: ServiceType,
  dates: string[],
): Promise<number | null> {
  const admin = createAdminClient();
  const fetes: string[] = [];
  let restant = bono ? bono.remaining_sessions : null;

  for (const scheduledAt of dates) {
    const { data: res, error } = await admin.rpc("book_individual_slot", {
      p_client_id: clientId,
      p_bono_id: bono ? bono.id : null,
      p_expected_remaining: restant,
      p_trainer_id: trainerId,
      p_scheduled_at: scheduledAt,
      p_service_type: serviceType,
      p_duration_minutes: SESSION_DURATION_MINUTES,
    });

    if (error || !res || !res.ok) {
      if (fetes.length > 0)
        await admin.from("reservations").delete().in("id", fetes);
      if (bono)
        await admin
          .from("bonos")
          .update({
            remaining_sessions: bono.remaining_sessions,
            status: bono.status,
          })
          .eq("id", bono.id);
      if (error) throw new Error("No s'ha pogut crear la reserva.");
      const motiu = res && !res.ok ? res.reason : null;
      if (motiu === "no_sessions")
        throw new Error("Aquest bo no té sessions disponibles.");
      throw new Error("Aquesta franja ja està ocupada.");
    }

    fetes.push(res.id);
    restant = bono ? res.remaining : null;
  }

  return restant;
}

/**
 * Crea una o més reserves a partir d'un bo, consumint una sessió per reserva.
 * Amb `repeatWeeks > 1` crea una reserva cada setmana a la mateixa hora.
 */
/**
 * Les de grup no es repeteixen setmana rere setmana.
 *
 * El formulari ja no ensenya el camp quan el servei és de grup, però el
 * `serviceType` real no se sap fins que s'ha llegit el bo, i això passa aquí
 * dins. Per això la comprovació viu en aquest fitxer i no al parseig del
 * formulari: és l'únic lloc on els dos camins —amb bo i de cortesia— ja han
 * resolt de quin servei parlen.
 *
 * Llança en comptes de retallar-ho a una de sola en silenci: qui ha enviat 8
 * setmanes ha de saber que no s'han fet, no descobrir-ho comptant reserves.
 */
function assertRepeatable(serviceType: ServiceType, weeks: number): void {
  if (weeks > 1 && !canRepeatInSeries(serviceType))
    throw new Error(
      "Les sessions de grup no es poden repetir cada setmana: s'han de crear d'una en una.",
    );
}

export async function createReservation(
  input: ReservationInput,
  repeatWeeks = 1,
): Promise<void> {
  const weeks = Math.max(1, Math.floor(repeatWeeks));
  const base = new Date(input.scheduledAt).getTime();
  const dates = Array.from({ length: weeks }, (_, i) =>
    new Date(base + i * 7 * 24 * 60 * 60 * 1000).toISOString(),
  );

  if (USE_MOCK) {
    const store = getStore();
    // Sense bo és una sessió de cortesia: el client i el tipus de servei venen
    // de l'entrada, i no hi ha comptador que mirar ni descomptar.
    const bono = input.bonoId
      ? store.bonos.find((b) => b.id === input.bonoId)
      : null;
    if (input.bonoId && !bono) throw new Error("Bo no trobat.");
    if (bono && bono.remaining_sessions < weeks)
      throw new Error(
        `Aquest bo només té ${bono.remaining_sessions} sessions disponibles.`,
      );
    const clientId = bono ? bono.client_id : input.clientId!;
    const serviceType = bono ? bono.service_type : input.serviceType!;
    assertRepeatable(serviceType, weeks);
    for (const scheduled_at of dates) {
      // La disponibilitat del professional també mana per aquí. Fins ara aquest
      // camí —el manual, el d'admin i professional— no la mirava gens: podia
      // col·locar una sessió a qualsevol hora, fos o no l'horari de ningú.
      await assertWithinAvailability(
        input.trainerId,
        new Date(scheduled_at),
        serviceType,
      );
      // L'aforament també es respecta en simulació: si no, un grup s'omplia
      // sense límit en local i petava en real, que és la pitjor manera
      // d'assabentar-se'n. Per SOLAPAMENT des de la 0082: abans es comparava
      // l'instant exacte i una sessió de 9:30 no veia la de 9:00.
      assertSlotFree(
        mockOccupants(store, input.trainerId, scheduled_at, SESSION_DURATION_MINUTES),
        serviceType,
      );
      store.reservations.push({
        id: crypto.randomUUID(),
        client_id: clientId,
        bono_id: bono ? bono.id : null,
        trainer_id: input.trainerId,
        scheduled_at,
        duration_minutes: SESSION_DURATION_MINUTES,
        // A la base l'escriu el trigger de la 0082. Aquí, a mà.
        ends_at: sessionEndIso(scheduled_at, SESSION_DURATION_MINUTES),
        service_type: serviceType,
        status: "booked",
        series_id: null,
        is_complimentary: !bono,
        cancelled_by_center: false,
        created_at: new Date().toISOString(),
      });
    }
    // Tot el que segueix és del bo. Una cortesia no en té: no descompta, no
    // canvia d'estat i no engega cap termini de pagament.
    if (bono) {
      bono.remaining_sessions -= weeks;
      // Un bo sense pagar que esgota sessions NO és "completat": si es
      // marqués així, ni l'admin el podria cobrar ni el barrido d'impagats el
      // trobaria mai. Es queda pendent fins que algú el pagui o decaigui.
      if (bono.remaining_sessions === 0 && bono.status === "active")
        bono.status = "completed";
      // Primera reserva feta amb aquest bo: engega el compte del termini de
      // pagament i ja no es torna a tocar.
      bono.first_reservation_at ??= new Date().toISOString();
    }
    saveStore(store);
    const trainerName = input.trainerId
      ? (store.profiles.find((p) => p.id === input.trainerId)?.full_name ?? null)
      : null;
    await notifyReservation(clientId, "reservation_confirmed", {
      scheduledAt: dates[0],
      serviceType,
      trainerName,
    });
    // L'avís de "et queden poques sessions" només té sentit si hi ha bo.
    if (bono)
      await afterBonoConsumed({
        bonoId: bono.id,
        clientId,
        serviceType,
        remaining: bono.remaining_sessions,
      });
    return;
  }

  const supabase = await createClient();

  // Sense bo, una sessió de cortesia: no hi ha res a llegir ni a comprovar.
  // Amb bo, exactament el mateix de sempre.
  let bono: {
    id: string;
    client_id: string;
    service_type: ServiceType;
    remaining_sessions: number;
    status: BonoStatus;
    first_reservation_at: string | null;
  } | null = null;

  if (input.bonoId) {
    const { data, error: bErr } = await supabase
      .from("bonos")
      .select("id, client_id, service_type, remaining_sessions, status, first_reservation_at")
      .eq("id", input.bonoId)
      .single();
    if (bErr || !data) throw new Error("Bo no trobat.");
    if (data.remaining_sessions < weeks)
      throw new Error(
        `Aquest bo només té ${data.remaining_sessions} sessions disponibles.`,
      );
    bono = data;
  }

  const clientId = bono ? bono.client_id : input.clientId!;
  const serviceType = bono ? bono.service_type : input.serviceType!;
  assertRepeatable(serviceType, weeks);

  // La disponibilitat del professional mana també per aquí. Aquest camí —el
  // manual d'admin i professional— no la mirava gens, i podia col·locar una
  // sessió a una hora que no era l'horari de ningú.
  for (const scheduled_at of dates)
    await assertWithinAvailability(
      input.trainerId,
      new Date(scheduled_at),
      serviceType,
    );

  // Els dos camins passen per una funció de Postgres que serialitza per
  // professional amb un advisory lock, i tots dos agafen la MATEIXA clau: és
  // l'única manera que un grup i una individual es vegin l'un a l'altre.
  //
  //   · Grup       → book_group_slot (0053/0070/0083). L'aforament no el pot
  //                  garantir cap índex: quatre files són quatre files.
  //   · No grup    → book_individual_slot (0084). La constraint de la 0082 ja
  //                  l'aturava contra una altra individual, però no contra un
  //                  grup, perquè les files de grup queden fora de la
  //                  constraint a posta.
  //
  // La cortesia NO obre cap camí paral·lel: passa per la mateixa funció, amb el
  // bo a null. El lock i el recompte són els mateixos, i per això una plaça
  // regalada ocupa lloc com qualsevol altra.
  //
  // Les dues escriuen amb la clau de servei, que se salta la RLS. Per això qui
  // mira el permís és `assertMayBookFor` i no la base.
  await assertMayBookFor(clientId);
  const remaining =
    serviceType === "grupo_reducido"
      ? await createGroupReservations(bono, clientId, input.trainerId, dates)
      : await createIndividualReservations(
          bono,
          clientId,
          input.trainerId,
          serviceType,
          dates,
        );

  const trainer = input.trainerId
    ? await getProfileContact(input.trainerId)
    : null;
  await notifyReservation(clientId, "reservation_confirmed", {
    scheduledAt: dates[0],
    serviceType,
    trainerName: trainer?.name ?? null,
  });
  // Sense bo no hi ha cap comptador que pugui anar baix.
  if (bono && remaining !== null)
    await afterBonoConsumed({
      bonoId: bono.id,
      clientId,
      serviceType,
      remaining,
    });
}


/**
 * Una franja s'ha alliberat: que hi entri qui l'esperava.
 *
 * Import dinàmic per trencar el cicle (waitlist.ts importa `slotHasRoom`
 * d'aquest fitxer). Mai llança: `promoteFromWaitlist` ja s'ho empassa tot, i
 * una cancel·lació no pot fallar perquè la cua vagi malament.
 */
async function afterCancel(r: {
  trainer_id: string | null;
  scheduled_at: string;
  service_type: ServiceType;
}): Promise<void> {
  const { promoteFromWaitlist } = await import("@/lib/data/waitlist");
  await promoteFromWaitlist({
    trainerId: r.trainer_id,
    scheduledAt: r.scheduled_at,
    serviceType: r.service_type,
  });
}

/**
 * Una cancel·lació NORMAL, a la base: `cancel_reservation` (0091).
 *
 * Reserva i sessió al bo van en una sola transacció, amb la fila bloquejada des
 * que es mira fins que es cancel·la. Abans eren dos UPDATE des d'aquí: si el
 * segon fallava, la reserva quedava cancel·lada i la sessió perduda; tornar-la
 * era llegir-i-escriure, i dues cancel·lacions del mateix bo alhora en podien
 * perdre una. El permís el decideix la funció amb la sessió de qui crida.
 *
 * Al mock, el seu mirall. `asClient` hi fa les comprovacions que a la base fa
 * `owns_client` i el marge de cancel·lació; sense, és l'equip i no en té cap.
 */
async function cancelOne(
  id: string,
  asClient?: { profileId: string },
): Promise<CancelReservationResult> {
  const today = centerToday();
  if (!USE_MOCK) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_reservation", {
      p_id: id,
      p_today: today,
    });
    if (error) throw error;
    return data as CancelReservationResult;
  }

  const store = getStore();
  const r = store.reservations.find((x) => x.id === id);
  if (!r) return { ok: false, reason: "not_found" };
  if (asClient) {
    const owner = store.clients.find((c) => c.id === r.client_id);
    if (!owner || owner.profile_id !== asClient.profileId)
      return { ok: false, reason: "forbidden" };
  }
  if (r.status !== "booked") return { ok: false, reason: "not_booked" };
  if (asClient) {
    if (new Date(r.scheduled_at).getTime() <= Date.now())
      return { ok: false, reason: "past" };
    const { minCancellationHours } = await getCenterSettings();
    if (!canCancelAt(r.scheduled_at, minCancellationHours))
      return { ok: false, reason: "too_late", hours: minCancellationHours };
  }
  r.status = "cancelled";
  let expired = false;
  if (r.bono_id) {
    const bono = store.bonos.find((b) => b.id === r.bono_id);
    if (bono) {
      bono.remaining_sessions = Math.min(
        bono.remaining_sessions + 1,
        bono.total_sessions,
      );
      if (bono.status === "completed") bono.status = "active";
      expired =
        bono.status === "expired" || (!!bono.expires_at && bono.expires_at < today);
    }
  }
  saveStore(store);
  return {
    ok: true,
    actor: asClient ? "client" : "admin",
    reservation_id: r.id,
    client_id: r.client_id,
    bono_id: r.bono_id,
    trainer_id: r.trainer_id,
    scheduled_at: r.scheduled_at,
    service_type: r.service_type,
    refunded: !!r.bono_id,
    bono_expired: expired,
  };
}

/** El que es diu a l'equip quan la base no ha cancel·lat res. */
const TEAM_CANCEL_ERROR: Record<"not_found" | "forbidden" | "past" | "too_late", string> = {
  not_found: "Aquesta reserva ja no existeix. No s'ha avisat ningú.",
  forbidden:
    "No pots cancel·lar aquesta reserva: no és de la teva agenda ni d'un client teu. No s'ha avisat ningú.",
  // Aquests dos només s'apliquen al client; si mai arribessin aquí, que es digui.
  past: "No es pot cancel·lar una sessió passada.",
  too_late: "Ja és massa a prop per cancel·lar-la.",
};

/**
 * Cancel·la una reserva des de l'EQUIP (admin o professional) i torna la
 * sessió al bo.
 *
 * El correu al client i la promoció de la cua van DESPRÉS, i només si la base
 * ha cancel·lat de debò. Si no, error clar i ningú no rep res: és el control
 * de la 0090 («zero files → error, sense correu»), ara amb un motiu concret.
 * Una reserva que ja no estava reservada no és cap error —algú altre l'ha
 * cancel·lat abans—: no es fa res i no s'avisa ningú, com sempre.
 */
export async function cancelReservation(id: string): Promise<void> {
  const res = await cancelOne(id);
  if (!res.ok) {
    if (res.reason === "not_booked") return;
    throw new Error(TEAM_CANCEL_ERROR[res.reason]);
  }
  await notifyReservation(res.client_id, "reservation_cancelled", {
    reservationId: res.reservation_id,
    scheduledAt: res.scheduled_at,
    serviceType: res.service_type,
  });
  await afterCancel({
    trainer_id: res.trainer_id,
    scheduled_at: res.scheduled_at,
    service_type: res.service_type,
  });
}

/**
 * Cancel·la reserves en nom del CENTRE, en tancar disponibilitat.
 *
 * Tres diferències amb `cancelReservation`, i les tres són el motiu d'existir:
 *
 *   1. Una sola transacció a la base (`cancel_reservations_by_center`, 0090):
 *      reserves i sessions als bons van juntes o no van. Mai no queda una
 *      reserva cancel·lada amb la sessió sense tornar.
 *   2. El permís el mira la funció: l'admin, o el professional sobre la seva
 *      agenda encara que el client estigui assignat a un altre. Amb el client
 *      de SESSIÓ, perquè el permís és qui crida.
 *   3. NO es promociona ningú de la llista d'espera. La franja no s'ha alliberat:
 *      ha deixat d'existir.
 *
 * Els correus surten només per a les files que la funció torna, que són les que
 * ha canviat ella: repetir la crida no n'envia cap de duplicat.
 */
export async function cancelReservationsByCenter(
  trainerId: string,
  ids: string[],
): Promise<CenterCancellationRow[]> {
  if (ids.length === 0) return [];
  const today = centerToday();
  let rows: CenterCancellationRow[];

  if (USE_MOCK) {
    // El mirall de la funció de la 0090, sense el permís (el mock no té
    // usuaris de debò; el decideix l'acció).
    const store = getStore();
    const nowIso = new Date().toISOString();
    rows = [];
    for (const r of store.reservations) {
      if (
        !ids.includes(r.id) ||
        r.trainer_id !== trainerId ||
        r.status !== "booked" ||
        r.scheduled_at <= nowIso
      )
        continue;
      r.status = "cancelled";
      r.cancelled_by_center = true;
      let expired = false;
      if (r.bono_id) {
        const b = store.bonos.find((x) => x.id === r.bono_id);
        if (b) {
          b.remaining_sessions = Math.min(b.remaining_sessions + 1, b.total_sessions);
          if (b.status === "completed") b.status = "active";
          expired = b.status === "expired" || (!!b.expires_at && b.expires_at < today);
        }
      }
      rows.push({
        reservation_id: r.id,
        client_id: r.client_id,
        bono_id: r.bono_id,
        trainer_id: trainerId,
        series_id: r.series_id,
        scheduled_at: r.scheduled_at,
        service_type: r.service_type,
        refunded: !!r.bono_id,
        bono_expired: expired,
      });
    }
    saveStore(store);
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_reservations_by_center", {
      p_trainer_id: trainerId,
      p_ids: ids,
      p_today: today,
    });
    if (error) throw error;
    rows = (data ?? []) as CenterCancellationRow[];
  }

  for (const row of rows)
    await notifyReservation(row.client_id, "reservation_cancelled", {
      reservationId: row.reservation_id,
      scheduledAt: row.scheduled_at,
      serviceType: row.service_type,
      byCenter: true,
      refund: !row.refunded ? "none" : row.bono_expired ? "expired" : "bono",
    });

  return rows;
}

/** Marca una reserva reservada como realizada. */
export async function completeReservation(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.reservations.find((x) => x.id === id);
    if (!r) throw new Error("Reserva no trobada.");
    if (r.status !== "booked") throw new Error(NOT_COMPLETED);
    r.status = "completed";
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  // `.select()`: una fila que la RLS no deixa tocar no dona error, dona zero
  // files. Sense això la pantalla deia «marcada com feta» i no ho estava.
  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("status", "booked")
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(NOT_COMPLETED);
}

const NOT_COMPLETED =
  "No s'ha pogut marcar com a feta: o ja no estava reservada, o no és d'un client teu.";

/** Reprograma una reserva (cambia la fecha/hora). Solo si está reservada. */
export async function rescheduleReservation(
  id: string,
  scheduledAt: string,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.reservations.find((x) => x.id === id);
    if (!r) throw new Error("Reserva no trobada.");
    if (r.status !== "booked")
      throw new Error("Només es poden reprogramar reserves actives.");
    r.scheduled_at = scheduledAt;
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ scheduled_at: scheduledAt })
    .eq("id", id)
    .eq("status", "booked");
  if (error) throw error;
}

// ──────────────── Autonomía del cliente (self-service) ────────────────
//
// El rol `client` no tiene RLS de escritura sobre reservations/bonos (no sería
// seguro: la RLS no puede forzar "descuenta exactamente 1"). Por eso estas
// acciones validan TODA la lógica de negocio en el servidor y escriben con el
// cliente service_role (createAdminClient). El cliente nunca controla el valor
// del bono.

export type ClientReservationInput = {
  profileId: string; // id del perfil del cliente (viewer.id)
  trainerId: string; // profesional dueño del slot elegido
  serviceType: ServiceType; // servicio del slot elegido
  scheduledAt: string; // ISO
};

/**
 * Reserva creada por el propio cliente. Lo que determina qué puede reservar es
 * el TIPO DE BONO, no el entrenador asignado: puede reservar con CUALQUIER
 * profesional cuya disponibilidad ofrezca un servicio para el que tenga bono
 * activo. Si tiene varios bonos activos de ese tipo, se consume el más antiguo
 * (FIFO por purchased_at).
 */
export async function createClientReservation(
  input: ClientReservationInput,
): Promise<void> {
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Data no vàlida.");
  if (when.getTime() <= Date.now())
    throw new Error("La data ha de ser futura.");

  // Antelació mínima per reservar (configurable; 0 = sense restricció).
  // Només s'aplica a l'autoservei del client: l'admin i els entrenadors poden
  // seguir creant reserves per a qualsevol moment futur.
  const { minBookingHours } = await getCenterSettings();
  if (minBookingHours > 0) {
    const marge = when.getTime() - Date.now();
    if (marge < minBookingHours * 3600_000) {
      const h = minBookingHours;
      throw new Error(
        h === 1
          ? "Has de reservar com a mínim 1 hora abans."
          : `Has de reservar com a mínim ${h} hores abans.`,
      );
    }
  }

  const scheduledAt = when.toISOString();
  const { trainerId, serviceType } = input;

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) throw new Error("Client no trobat.");
    const bono = store.bonos
      .filter(
        (b) =>
          b.client_id === client.id &&
          b.service_type === serviceType &&
          (b.status === "active" || b.status === "pending_payment") &&
          b.remaining_sessions > 0 &&
          // Un bo caducat no serveix encara que l'escombrat no hi hagi passat.
          !isBonoExpired(b),
      )
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at))[0];
    if (!bono)
      throw new Error("No tens cap bo actiu d'aquest tipus amb sessions.");
    // També per solapament: el client no pot estar a dos llocs alhora, i "a la
    // mateixa hora" ja no vol dir "amb el mateix instant d'inici".
    const startMs = when.getTime();
    const endMs = startMs + SESSION_DURATION_MINUTES * 60_000;
    const clientAlreadyBooked = store.reservations.some(
      (r) =>
        r.client_id === client.id &&
        r.status === "booked" &&
        rangesOverlap(startMs, endMs, new Date(r.scheduled_at).getTime(), rowEndMs(r)),
    );
    if (clientAlreadyBooked) throw new Error("Ja tens una reserva a aquesta hora.");
    await assertWithinAvailability(trainerId, when, serviceType);
    assertSlotFree(
      [
        // Per SOLAPAMENT, no per instant igual: una sessió de 9:00 i una de
        // 9:30 es trepitgen mitja hora i abans no es veien.
        ...mockOccupants(store, trainerId, scheduledAt, SESSION_DURATION_MINUTES),
        // Les proves 'pending'/'confirmed' també ocupen el forat.
        ...mockActiveHoldsAt(store, trainerId, scheduledAt, SESSION_DURATION_MINUTES),
      ],
      serviceType,
    );
    store.reservations.push({
      id: crypto.randomUUID(),
      client_id: client.id,
      duration_minutes: SESSION_DURATION_MINUTES,
      ends_at: sessionEndIso(scheduledAt, SESSION_DURATION_MINUTES),
      bono_id: bono.id,
      trainer_id: trainerId,
      scheduled_at: scheduledAt,
      service_type: serviceType,
      status: "booked",
      series_id: null,
      is_complimentary: false,
      cancelled_by_center: false,
      created_at: new Date().toISOString(),
    });
    bono.remaining_sessions -= 1;
    if (bono.remaining_sessions === 0 && bono.status === "active")
      bono.status = "completed";
    bono.first_reservation_at ??= new Date().toISOString();
    saveStore(store);
    const trainerName =
      store.profiles.find((p) => p.id === trainerId)?.full_name ?? null;
    await notifyReservation(client.id, "reservation_confirmed", {
      scheduledAt,
      serviceType,
      trainerName,
    });
    await afterBonoConsumed({
      bonoId: bono.id,
      clientId: client.id,
      serviceType,
      remaining: bono.remaining_sessions,
    });
    // L'acció l'ha fet el client → avisa el professional de la nova reserva.
    const clientName =
      store.profiles.find((p) => p.id === input.profileId)?.full_name ?? null;
    await notifyTrainerBooking(trainerId, "trainer_booking_received", {
      clientName,
      scheduledAt,
      serviceType,
    });
    return;
  }

  const admin = createAdminClient();

  // 1. Cliente.
  const { data: client, error: cErr } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", input.profileId)
    .single();
  if (cErr || !client) throw new Error("Client no trobat.");

  // 1b. El client no pot tenir dues reserves confirmades a la mateixa hora.
  const { data: clientConflict } = await admin
    .from("reservations")
    .select("id")
    .eq("client_id", client.id)
    .eq("scheduled_at", scheduledAt)
    .eq("status", "booked")
    .maybeSingle();
  if (clientConflict) throw new Error("Ja tens una reserva a aquesta hora.");

  // 2. La franja debe estar dentro de la disponibilidad de ESE profesional para
  //    ESE servicio.
  await assertWithinAvailability(trainerId, when, serviceType);

  // 3. Bono más antiguo activo de este tipo con sesiones (FIFO).
  const { data: bono, error: bErr } = await admin
    .from("bonos")
    .select("id, remaining_sessions, status, first_reservation_at")
    .eq("client_id", client.id)
    .eq("service_type", serviceType)
    .in("status", ["active", "pending_payment"])
    .gt("remaining_sessions", 0)
    // Caducats fora: o no en tenen data, o encara no ha passat.
    .or(`expires_at.is.null,expires_at.gte.${centerToday()}`)
    .order("purchased_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!bono)
    throw new Error("No tens cap bo actiu d'aquest tipus amb sessions.");

  const nextRemaining = bono.remaining_sessions - 1;

  if (serviceType === "grupo_reducido") {
    // 4-6 (grup). Comptar places aquí i inserir després és una cursa: entre el
    // recompte i l'INSERT no hi ha res, i deu peticions simultànies veuen
    // totes la mateixa franja buida. Als serveis individuals no passa perquè
    // l'índex únic de la 0007 hi posa una garantia de base de dades; un grup
    // admet quatre files legítimes i cap índex ho pot expressar.
    //
    // Per això tot el tram crític viu dins d'una funció de Postgres que agafa
    // un advisory lock de la franja: comptar, reclamar la sessió del bo i
    // inserir passen en una sola transacció i per torns. Les altres franges no
    // s'esperen.
    const { data: res, error: gErr } = await admin.rpc("book_group_slot", {
      p_client_id: client.id,
      p_bono_id: bono.id,
      p_expected_remaining: bono.remaining_sessions,
      p_trainer_id: trainerId,
      p_scheduled_at: scheduledAt,
      p_capacity: GROUP_CAPACITY,
      p_duration_minutes: SESSION_DURATION_MINUTES,
    });
    if (gErr) throw new Error("No s'ha pogut crear la reserva.");
    if (!res || !res.ok) {
      // Els mateixos missatges de sempre: qui reserva no ha de notar que per
      // dins això ha canviat de lloc.
      if (res?.reason === "taken")
        throw new Error("Aquesta franja ja està ocupada.");
      if (res?.reason === "no_sessions")
        throw new Error("Aquest bo no té sessions disponibles.");
      throw new Error("El grup d'aquesta franja ja està complet.");
    }
  } else {
    // 4. Comprovar la franja, descomptar la sessió i inserir, tot dins del
    //    mateix pany i la mateixa transacció (`book_individual_slot`, 0084).
    //
    //    Abans això eren tres passos de l'aplicació: mirar si la franja estava
    //    lliure, descomptar el bo i inserir, i si l'INSERT petava, tornar la
    //    sessió al bo a mà. Dues coses no quadraven:
    //
    //      · Entre el SELECT i l'INSERT no hi havia res. La constraint de la
    //        0082 tapava el xoc contra una altra individual, però no contra un
    //        GRUP, que en queda fora a posta.
    //      · El "torna la sessió" escrivia `status: 'active'`, i el bo podia
    //        ser 'pending_payment'. Donar-lo per actiu el cobrava per la cara.
    //
    //    Dins de la funció no hi ha res a desfer: si l'INSERT peta, l'excepció
    //    se'n duu el descompte amb ella.
    const { data: res, error: bErr2 } = await admin.rpc("book_individual_slot", {
      p_client_id: client.id,
      p_bono_id: bono.id,
      p_expected_remaining: bono.remaining_sessions,
      p_trainer_id: trainerId,
      p_scheduled_at: scheduledAt,
      p_service_type: serviceType,
      p_duration_minutes: SESSION_DURATION_MINUTES,
    });
    if (bErr2) throw new Error("No s'ha pogut crear la reserva.");
    if (!res || !res.ok) {
      // Els mateixos missatges de sempre: qui reserva no ha de notar que per
      // dins això ha canviat de lloc.
      if (res?.reason === "no_sessions")
        throw new Error("Aquest bo no té sessions disponibles.");
      throw new Error("Aquesta franja ja està ocupada.");
    }
  }

  const trainer = await getProfileContact(trainerId);
  await notifyReservation(client.id, "reservation_confirmed", {
    scheduledAt,
    serviceType,
    trainerName: trainer?.name ?? null,
  });
  await afterBonoConsumed({
    bonoId: bono.id,
    clientId: client.id,
    serviceType,
    remaining: nextRemaining,
  });
  // L'acció l'ha fet el client → avisa el professional de la nova reserva.
  const me = await getProfileContact(input.profileId);
  await notifyTrainerBooking(trainerId, "trainer_booking_received", {
    clientName: me?.name ?? null,
    scheduledAt,
    serviceType,
  });
}

/**
 * El CLIENT cancel·la una reserva seva i la sessió torna al bo.
 *
 * Passa per la mateixa funció que l'equip (`cancel_reservation`, 0091), que
 * comprova a la base que la reserva sigui seva, futura i fora del marge de
 * cancel·lació, i ho fa tot en una transacció. Abans ho feia aquí amb la clau de
 * servei: dos UPDATE separats, i el de la reserva no filtrava per 'booked', o
 * sigui que dues cancel·lacions alhora de la mateixa reserva podien tornar la
 * sessió dues vegades.
 *
 * `profileId` és qui ha entrat. A la base el permís el dona la sessió; al mock,
 * que no en té, aquest paràmetre.
 */
export async function cancelClientReservation(
  profileId: string,
  reservationId: string,
): Promise<void> {
  const res = await cancelOne(reservationId, { profileId });
  if (!res.ok) {
    switch (res.reason) {
      case "too_late":
        throw new TooLateToCancelError(res.hours ?? 0);
      case "past":
        throw new Error("No pots cancel·lar una sessió passada.");
      case "not_booked":
        throw new Error("Només pots cancel·lar reserves actives.");
      case "forbidden":
        throw new Error("Aquesta reserva no és teva.");
      default:
        throw new Error("Reserva no trobada.");
    }
  }

  // L'acció l'ha fet el client → avisa el professional de la cancel·lació.
  if (res.trainer_id) {
    const client = await clientContact(res.client_id);
    await notifyTrainerBooking(res.trainer_id, "trainer_booking_cancelled", {
      clientName: client?.name ?? null,
      scheduledAt: res.scheduled_at,
      serviceType: res.service_type,
    });
  }
  await afterCancel({
    trainer_id: res.trainer_id,
    scheduled_at: res.scheduled_at,
    service_type: res.service_type,
  });
}

/** Reserva para el calendario del cliente: SIN nombres de otros clientes. */
export type ClientCalendarReservation = {
  id: string;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
  isOwn: boolean;
};

export type ClientReservationData = {
  clientId: string | null;
  trainerId: string | null;
  trainerName: string | null;
  bonos: { id: string; serviceType: ServiceType; remaining: number }[];
  reservations: ClientCalendarReservation[];
};
