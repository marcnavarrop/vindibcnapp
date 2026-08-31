import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { slotHasRoom } from "@/lib/data/reservations";
import { isBonoExpired } from "@/lib/data/bonos";
import { GROUP_CAPACITY } from "@/lib/labels";
import { notify, getProfileContact } from "@/lib/notifications";
import { getCenterSettings } from "@/lib/data/center-settings";
import { centerDateStr, centerLocalToInstant } from "@/lib/center-time";
import type { BonoStatus, ServiceType, WaitlistStatus } from "@/types/database";

/**
 * Llista d'espera: qui es queda fora d'una franja plena i què passa quan
 * s'allibera.
 *
 * `promoteFromWaitlist` és el PUNT ÚNIC que criden TOTS els camins que
 * cancel·len una reserva (el client des de la seva àrea, l'admin o el
 * professional des de l'agenda, i l'escombrat de bons impagats). Viu aquí i no
 * dins de cadascun perquè ja ens ha passat massa vegades avui que una regla
 * escrita a tres llocs s'arreglava a dos: si demà apareix un quart camí de
 * cancel·lació, l'única cosa que ha de fer és cridar aquesta funció.
 */

/** L'hora d'una franja tal com es desa a la cua: data i hora del CENTRE. */
export function slotKeyOf(scheduledAt: string): {
  date: string;
  time: string;
} {
  const d = new Date(scheduledAt);
  const date = centerDateStr(d);
  // `desired_time` és un `time` de Postgres: sempre "HH:MM:SS".
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Madrid",
  }).format(d);
  return { date, time: `${hhmm}:00` };
}

export type WaitlistEntryInput = {
  clientId: string;
  bonoId: string | null;
  serviceType: ServiceType;
  trainerId: string | null;
  /** Data i hora desitjades, en hora del CENTRE. */
  desiredDate: string;
  desiredTime: string;
  seriesId?: string | null;
};

export async function addToWaitlist(input: WaitlistEntryInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.waitlist_entries.push({
      id,
      client_id: input.clientId,
      bono_id: input.bonoId,
      service_type: input.serviceType,
      trainer_id: input.trainerId,
      desired_date: input.desiredDate,
      desired_time: input.desiredTime,
      series_id: input.seriesId ?? null,
      status: "waiting",
      created_at: new Date().toISOString(),
      fulfilled_at: null,
      fulfilled_reservation_id: null,
    });
    saveStore(store);
    return id;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("waitlist_entries")
    .insert({
      client_id: input.clientId,
      bono_id: input.bonoId,
      service_type: input.serviceType,
      trainer_id: input.trainerId,
      desired_date: input.desiredDate,
      desired_time: input.desiredTime,
      series_id: input.seriesId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No s'ha pogut apuntar a la llista d'espera.");
  return data.id;
}

/**
 * El client s'apunta a la cua d'una franja plena, sense passar per cap sèrie.
 *
 * Totes les condicions es comproven AQUÍ i no a la pantalla: amagar el botó no
 * és protegir res, i aquesta funció és l'única porta d'entrada per a una espera
 * solta. L'ordre és el mateix que faria una persona raonable:
 *
 *   1. El centre ha de tenir la cua oberta.
 *   2. La sessió ha de ser al futur (apuntar-se a ahir no vol dir res).
 *   3. Has de tenir un bo que et deixi venir: si s'alliberés la plaça i no la
 *      poguessis fer servir, apuntar-t'hi seria enganyar-te.
 *   4. La franja ha d'estar realment plena; si hi ha lloc, el que toca és
 *      reservar-la i no fer cua.
 *   5. Ni dues vegades a la mateixa cua ni tenir-hi ja una reserva.
 */
export async function joinWaitlist(input: {
  profileId: string;
  trainerId: string;
  serviceType: ServiceType;
  scheduledAt: string;
}): Promise<string> {
  const { waitlistEnabled } = await getCenterSettings();
  if (!waitlistEnabled)
    throw new Error("La llista d'espera no està disponible ara mateix.");

  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Data no vàlida.");
  if (when.getTime() <= Date.now())
    throw new Error("Aquesta sessió ja ha passat.");

  const { date, time } = slotKeyOf(input.scheduledAt);

  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === input.profileId);
    if (!client) throw new Error("No tens fitxa de client.");

    const bono = store.bonos.find(
      (b) =>
        b.client_id === client.id &&
        b.service_type === input.serviceType &&
        (b.status === "active" || b.status === "pending_payment") &&
        b.remaining_sessions > 0 &&
        !isBonoExpired(b),
    );
    if (!bono)
      throw new Error("Necessites un bo actiu d'aquest servei amb sessions.");

    const here = store.reservations.filter(
      (r) =>
        r.trainer_id === input.trainerId &&
        new Date(r.scheduled_at).getTime() === when.getTime() &&
        r.status === "booked",
    );
    if (slotHasRoom(here, input.serviceType))
      throw new Error("Aquesta sessió encara té plaça: pots reservar-la.");
    if (here.some((r) => r.client_id === client.id))
      throw new Error("Ja tens una reserva en aquesta sessió.");
    if (
      store.reservations.some(
        (r) =>
          r.client_id === client.id &&
          new Date(r.scheduled_at).getTime() === when.getTime() &&
          r.status === "booked",
      )
    )
      throw new Error("Ja tens una altra sessió a aquesta hora.");
    if (
      store.waitlist_entries.some(
        (w) =>
          w.client_id === client.id &&
          w.status === "waiting" &&
          w.desired_date === date &&
          w.desired_time === time &&
          w.service_type === input.serviceType,
      )
    )
      throw new Error("Ja ets a la llista d'espera d'aquesta sessió.");

    return addToWaitlist({
      clientId: client.id,
      bonoId: bono.id,
      serviceType: input.serviceType,
      trainerId: input.trainerId,
      desiredDate: date,
      desiredTime: time,
    });
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (!client) throw new Error("No tens fitxa de client.");

  const { data: bonos } = await admin
    .from("bonos")
    .select("id, remaining_sessions, status, expires_at")
    .eq("client_id", client.id)
    .eq("service_type", input.serviceType)
    .in("status", ["active", "pending_payment"])
    .gt("remaining_sessions", 0)
    .order("purchased_at", { ascending: true });
  const bono = (bonos ?? []).find(
    (b) => !isBonoExpired({ status: b.status, expires_at: b.expires_at }),
  );
  if (!bono)
    throw new Error("Necessites un bo actiu d'aquest servei amb sessions.");

  const { data: here } = await admin
    .from("reservations")
    .select("service_type, client_id")
    .eq("trainer_id", input.trainerId)
    .eq("scheduled_at", input.scheduledAt)
    .eq("status", "booked");
  const occupied = (here ?? []) as { service_type: ServiceType; client_id: string }[];
  if (slotHasRoom(occupied, input.serviceType))
    throw new Error("Aquesta sessió encara té plaça: pots reservar-la.");
  if (occupied.some((r) => r.client_id === client.id))
    throw new Error("Ja tens una reserva en aquesta sessió.");

  const { data: clash } = await admin
    .from("reservations")
    .select("id")
    .eq("client_id", client.id)
    .eq("scheduled_at", input.scheduledAt)
    .eq("status", "booked")
    .maybeSingle();
  if (clash) throw new Error("Ja tens una altra sessió a aquesta hora.");

  const { data: already } = await admin
    .from("waitlist_entries")
    .select("id")
    .eq("client_id", client.id)
    .eq("status", "waiting")
    .eq("desired_date", date)
    .eq("desired_time", time)
    .eq("service_type", input.serviceType)
    .maybeSingle();
  if (already) throw new Error("Ja ets a la llista d'espera d'aquesta sessió.");

  return addToWaitlist({
    clientId: client.id,
    bonoId: bono.id,
    serviceType: input.serviceType,
    trainerId: input.trainerId,
    desiredDate: date,
    desiredTime: time,
  });
}

export type PromotionResult =
  | { promoted: false; reason: string }
  | { promoted: true; clientId: string; reservationId: string };

/**
 * Torna el bo com estava quan la promoció no acaba d'entrar.
 *
 * Es restaura l'estat LLEGIT, no "active": un bo pendent de pagament que
 * tornés actiu quedaria com a cobrat sense que ningú hagi pagat res.
 */
async function restoreBono(
  admin: ReturnType<typeof createAdminClient>,
  bonoId: string,
  remaining: number,
  status: BonoStatus,
): Promise<void> {
  await admin
    .from("bonos")
    .update({ remaining_sessions: remaining, status })
    .eq("id", bonoId);
}

/**
 * S'ha alliberat una franja: entra el primer de la cua, si n'hi ha.
 *
 * MAI llança. Una cancel·lació no pot fallar perquè la promoció hagi anat
 * malament: qui cancel·lava tenia dret a fer-ho, i el pitjor cas acceptable és
 * que la plaça es quedi lliure i el següent de la cua ho intenti un altre dia.
 *
 * Es prova amb els candidats en ordre d'antiguitat i s'atura al primer que
 * entra de debò: si el més antic ja no té sessions al bo o ja té una altra
 * reserva a aquella hora, no bloqueja la cua per als altres.
 *
 * L'aforament dels grups NO es decideix aquí: el compta i el reclama
 * `book_group_slot` (0053), dins d'un advisory lock per franja.
 */
export async function promoteFromWaitlist(freed: {
  trainerId: string | null;
  scheduledAt: string;
  serviceType: ServiceType;
}): Promise<PromotionResult> {
  try {
    const { date, time } = slotKeyOf(freed.scheduledAt);

    if (USE_MOCK) return promoteMock(freed, date, time);

    const admin = createAdminClient();

    // Candidats: mateixa franja exacta, encara esperant, del més antic al
    // més nou. `trainer_id` null = "m'és igual qui" i també hi entra.
    let q = admin
      .from("waitlist_entries")
      .select("id, client_id, bono_id, service_type")
      .eq("status", "waiting")
      .eq("desired_date", date)
      .eq("desired_time", time)
      .eq("service_type", freed.serviceType)
      .order("created_at", { ascending: true });
    q = freed.trainerId
      ? q.or(`trainer_id.eq.${freed.trainerId},trainer_id.is.null`)
      : q.is("trainer_id", null);
    const { data: candidates } = await q;
    if (!candidates || candidates.length === 0)
      return { promoted: false, reason: "Ningú a la cua." };

    // Sense professional no hi ha franja: l'aforament es compta per
    // (professional, hora), i és la clau amb què `book_group_slot` agafa el
    // seu torn. Abans s'hi passava `?? ""`, que a una columna uuid no és cap
    // filtre sinó un error de Postgres: la consulta no tornava res i el codi
    // en deduïa que la franja estava buida.
    const trainerId = freed.trainerId;
    if (!trainerId)
      return { promoted: false, reason: "La franja no té professional." };

    // La franja ha de seguir tenint lloc: en un grup, alliberar-ne una plaça no
    // vol dir que el grup s'hagi buidat. Als grups això és només un descart
    // ràpid — qui mana és `book_group_slot`, que compta dins del lock.
    const { data: existing } = await admin
      .from("reservations")
      .select("service_type, client_id")
      .eq("trainer_id", trainerId)
      .eq("scheduled_at", freed.scheduledAt)
      .eq("status", "booked");
    const occupied = (existing ?? []) as { service_type: ServiceType; client_id: string }[];
    if (!slotHasRoom(occupied, freed.serviceType))
      return { promoted: false, reason: "La franja segueix plena." };

    for (const c of candidates) {
      // Ja hi és? (pot passar en un grup on el mateix client hi tingui plaça)
      if (occupied.some((o) => o.client_id === c.client_id)) continue;

      // Ha de tenir sessions. Es mira el bo que va apuntar i, si ja no serveix,
      // qualsevol altre del mateix tipus: el que compta és que pugui venir.
      const { data: bonos } = await admin
        .from("bonos")
        .select("id, remaining_sessions, status, expires_at, first_reservation_at, total_sessions")
        .eq("client_id", c.client_id)
        .eq("service_type", c.service_type)
        .in("status", ["active", "pending_payment"])
        .gt("remaining_sessions", 0)
        .order("purchased_at", { ascending: true });
      const bono = (bonos ?? []).find(
        (b) => !isBonoExpired({ status: b.status, expires_at: b.expires_at }),
      );
      if (!bono) continue;

      // Cap altra reserva seva a la mateixa hora.
      const { data: clash } = await admin
        .from("reservations")
        .select("id")
        .eq("client_id", c.client_id)
        .eq("scheduled_at", freed.scheduledAt)
        .eq("status", "booked")
        .maybeSingle();
      if (clash) continue;

      // Reclam de la plaça i de la sessió.
      //
      // Als grups ho fa `book_group_slot` (0053) i no un SELECT + INSERT
      // d'aquí. Comptar les places en aquest fitxer i inserir després és
      // exactament la cursa que la migració va tancar per a la reserva
      // normal, i aquest camí se la va deixar oberta: dues cancel·lacions
      // simultànies de la mateixa franja veien totes dues la plaça lliure i
      // promocionaven totes dues, i el grup acabava amb cinc. La funció
      // serialitza per franja amb un advisory lock, compta també les sessions
      // de prova i reclama la sessió del bo dins de la mateixa transacció.
      let createdId: string;

      if (c.service_type === "grupo_reducido") {
        const { data: res, error: gErr } = await admin.rpc("book_group_slot", {
          p_client_id: c.client_id,
          p_bono_id: bono.id,
          p_expected_remaining: bono.remaining_sessions,
          p_trainer_id: trainerId,
          p_scheduled_at: freed.scheduledAt,
          p_capacity: GROUP_CAPACITY,
        });
        if (gErr) return { promoted: false, reason: "Error en la promoció." };
        if (!res || !res.ok) {
          // 'no_sessions' és cosa d'AQUEST candidat (el bo li ha canviat sota
          // els peus): el següent de la cua encara pot entrar-hi. 'taken' i
          // 'full' són de la FRANJA: si ja no hi cap ningú, no cal seguir
          // provant candidats.
          if (res?.reason === "no_sessions") continue;
          return { promoted: false, reason: "La franja segueix plena." };
        }
        createdId = res.id;
      } else {
        // Serveis individuals: la garantia real és l'índex únic de la 0007,
        // igual que a `createClientReservation`. Reclam optimista i INSERT.
        const next = bono.remaining_sessions - 1;
        const { data: claimed } = await admin
          .from("bonos")
          .update({
            remaining_sessions: next,
            ...(next === 0 && bono.status === "active"
              ? { status: "completed" as const }
              : {}),
            ...(bono.first_reservation_at
              ? {}
              : { first_reservation_at: new Date().toISOString() }),
          })
          .eq("id", bono.id)
          .eq("remaining_sessions", bono.remaining_sessions)
          .select("id")
          .single();
        if (!claimed) continue;

        const { data: created, error: rErr } = await admin
          .from("reservations")
          .insert({
            client_id: c.client_id,
            bono_id: bono.id,
            trainer_id: trainerId,
            scheduled_at: freed.scheduledAt,
            service_type: c.service_type,
            status: "booked",
          })
          .select("id")
          .single();
        if (rErr || !created) {
          // Torna la sessió: la plaça se l'ha endut algú altre pel mig.
          // `bono.status` i no "active": el bo podia ser 'pending_payment' i
          // donar-lo per actiu el cobraria per la cara.
          await restoreBono(admin, bono.id, bono.remaining_sessions, bono.status);
          continue;
        }
        createdId = created.id;
      }

      // `eq("status","waiting")` tanca la cursa: si dues cancel·lacions
      // simultànies miren la mateixa entrada, només una la promociona.
      const { data: marked } = await admin
        .from("waitlist_entries")
        .update({
          status: "fulfilled" as WaitlistStatus,
          fulfilled_at: new Date().toISOString(),
          fulfilled_reservation_id: createdId,
        })
        .eq("id", c.id)
        .eq("status", "waiting")
        .select("id");
      if (!marked || marked.length === 0) {
        // Ha guanyat l'altra: es desfà la reserva que acabem de crear.
        await admin.from("reservations").delete().eq("id", createdId);
        await restoreBono(admin, bono.id, bono.remaining_sessions, bono.status);
        continue;
      }

      await notifyPromotion(c.client_id, freed, createdId);
      return { promoted: true, clientId: c.client_id, reservationId: createdId };
    }

    return { promoted: false, reason: "Cap candidat podia agafar-la." };
  } catch {
    // Best-effort absolut: mai tombar una cancel·lació per això.
    return { promoted: false, reason: "Error en la promoció." };
  }
}

async function promoteMock(
  freed: { trainerId: string | null; scheduledAt: string; serviceType: ServiceType },
  date: string,
  time: string,
): Promise<PromotionResult> {
  const store = getStore();
  const candidates = store.waitlist_entries
    .filter(
      (w) =>
        w.status === "waiting" &&
        w.desired_date === date &&
        w.desired_time === time &&
        w.service_type === freed.serviceType &&
        (w.trainer_id === null || w.trainer_id === freed.trainerId),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (candidates.length === 0) return { promoted: false, reason: "Ningú a la cua." };

  const occupied = store.reservations.filter(
    (r) =>
      r.trainer_id === freed.trainerId &&
      r.scheduled_at === freed.scheduledAt &&
      r.status === "booked",
  );
  if (!slotHasRoom(occupied, freed.serviceType))
    return { promoted: false, reason: "La franja segueix plena." };

  for (const c of candidates) {
    if (occupied.some((o) => o.client_id === c.client_id)) continue;
    const bono = store.bonos
      .filter(
        (b) =>
          b.client_id === c.client_id &&
          b.service_type === c.service_type &&
          (b.status === "active" || b.status === "pending_payment") &&
          b.remaining_sessions > 0 &&
          !isBonoExpired(b),
      )
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at))[0];
    if (!bono) continue;
    if (
      store.reservations.some(
        (r) =>
          r.client_id === c.client_id &&
          r.scheduled_at === freed.scheduledAt &&
          r.status === "booked",
      )
    )
      continue;

    const id = crypto.randomUUID();
    store.reservations.push({
      id,
      client_id: c.client_id,
      bono_id: bono.id,
      trainer_id: freed.trainerId,
      scheduled_at: freed.scheduledAt,
      service_type: c.service_type,
      status: "booked",
      series_id: null,
      created_at: new Date().toISOString(),
    });
    bono.remaining_sessions -= 1;
    if (bono.remaining_sessions === 0 && bono.status === "active")
      bono.status = "completed";
    c.status = "fulfilled";
    c.fulfilled_at = new Date().toISOString();
    c.fulfilled_reservation_id = id;
    saveStore(store);
    await notifyPromotion(c.client_id, freed, id);
    return { promoted: true, clientId: c.client_id, reservationId: id };
  }
  return { promoted: false, reason: "Cap candidat podia agafar-la." };
}

/** Avisa qui entra des de la cua. Respecta preferències; mai llança. */
async function notifyPromotion(
  clientId: string,
  freed: { trainerId: string | null; scheduledAt: string; serviceType: ServiceType },
  reservationId: string,
): Promise<void> {
  const profileId = await profileOfClient(clientId);
  if (!profileId) return;
  const contact = await getProfileContact(profileId);
  if (!contact) return;
  const trainer = freed.trainerId ? await getProfileContact(freed.trainerId) : null;
  await notify({
    type: "waitlist_fulfilled",
    recipient: contact,
    // La reserva acabada de crear, no l'instant: `notification_log.related_id`
    // és un uuid, i amb una marca de temps la inserció fallava. `notify` s'ho
    // empassava tot i l'avís no quedava registrat enlloc.
    relatedId: reservationId,
    data: {
      name: contact.name ?? "",
      whenIso: freed.scheduledAt,
      serviceType: freed.serviceType,
      trainer: trainer?.name ?? "",
    },
  });
}

async function profileOfClient(clientId: string): Promise<string | null> {
  if (USE_MOCK)
    return getStore().clients.find((c) => c.id === clientId)?.profile_id ?? null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .maybeSingle();
  return data?.profile_id ?? null;
}

// ─── Lectura per a la UI ────────────────────────────────────────────────────

export type WaitlistItem = {
  id: string;
  serviceType: ServiceType;
  trainerId: string | null;
  desiredAt: string;
  status: WaitlistStatus;
  seriesId: string | null;
};

/** Les esperes d'un client, de la més propera a la més llunyana. */
export async function listWaitlistForClient(
  clientId: string,
): Promise<WaitlistItem[]> {
  const toItem = (w: {
    id: string;
    service_type: ServiceType;
    trainer_id: string | null;
    desired_date: string;
    desired_time: string;
    status: WaitlistStatus;
    series_id: string | null;
  }): WaitlistItem => ({
    id: w.id,
    serviceType: w.service_type,
    trainerId: w.trainer_id,
    desiredAt: centerLocalToInstant(
      w.desired_date,
      w.desired_time.slice(0, 5),
    ).toISOString(),
    status: w.status,
    seriesId: w.series_id,
  });

  if (USE_MOCK)
    return getStore()
      .waitlist_entries.filter((w) => w.client_id === clientId)
      .map(toItem)
      .sort((a, b) => a.desiredAt.localeCompare(b.desiredAt));

  const admin = createAdminClient();
  const { data } = await admin
    .from("waitlist_entries")
    .select("id, service_type, trainer_id, desired_date, desired_time, status, series_id")
    .eq("client_id", clientId)
    .order("desired_date", { ascending: true });
  return (data ?? []).map(toItem);
}

/** El client es desapunta d'una espera seva. */
export async function cancelWaitlistEntry(
  clientId: string,
  entryId: string,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const w = store.waitlist_entries.find(
      (x) => x.id === entryId && x.client_id === clientId,
    );
    if (w && w.status === "waiting") w.status = "cancelled";
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  await admin
    .from("waitlist_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId)
    .eq("client_id", clientId)
    .eq("status", "waiting");
}
