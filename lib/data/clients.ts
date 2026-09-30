import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBonoExpired } from "@/lib/data/bonos";
import { getStore, saveStore } from "@/lib/mock/store";
import { createUserWithInvite } from "@/lib/notifications/auth-emails";
import { foldName, matchesName, nameWords, wordRegex } from "@/lib/client-search-match";
import { digitsOnly } from "@/lib/utils";
import type {
  ServiceType,
  BonoStatus,
  ReservationStatus,
  PaymentMethod,
  PreferredLanguage,
  Gender,
} from "@/types/database";

/** Cliente enriquecido para listados (nombre, entrenador, sesiones restantes). */
export type ClientListItem = {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  phone: string | null;
  trainerName: string | null;
  activeBonos: number;
  remainingSessions: number;
};

/**
 * Per què aquest bo no pot dur renovació automàtica, mirant NOMÉS la fila.
 *
 * La quarta porta —que el client ja tingui subscripció viva d'aquest servei—
 * no es pot respondre des d'aquí i la comprova `setBonoAutoRenew` en desar. La
 * pantalla, doncs, pot oferir l'interruptor i rebre un no: és el mateix
 * criteri que segueix tota la casa, que qui mana és el servidor i no el que
 * s'hagi pintat.
 */
function autoRenewBlockOf(b: {
  service_id?: string | null;
  gift_voucher_id?: string | null;
  subscription_id?: string | null;
}): "noPackage" | "fromGift" | "fromSubscription" | null {
  if (b.subscription_id) return "fromSubscription";
  if (b.gift_voucher_id) return "fromGift";
  if (!b.service_id) return "noPackage";
  return null;
}

export type ClientBono = {
  id: string;
  serviceType: ServiceType;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  status: BonoStatus;
  /** Data de caducitat fixada en comprar-lo. Null = no caduca. */
  expiresAt: string | null;
  /**
   * El mes d'una subscripció, si n'és. La fitxa ho necessita per no oferir
   * d'anul·lar-lo: donar-se de baixa té el seu camí (`cancelBlockFor`).
   */
  subscriptionId: string | null;
  /** Renovació automàtica demanada pel client (0088). */
  autoRenew: boolean;
  /**
   * Què impedeix encendre-li la renovació, si és que hi ha res.
   *
   * Es resol AQUÍ i no a la pantalla perquè depèn de coses que la pantalla no
   * té: d'on va sortir el bo i si el client ja té subscripció d'aquest servei.
   * La pantalla només ha de saber si pinta l'interruptor i què hi diu.
   */
  autoRenewBlock:
    | "noPackage"
    | "fromGift"
    | "fromSubscription"
    | null;
};

export type ClientReservation = {
  id: string;
  scheduledAt: string;
  serviceType: ServiceType;
  status: ReservationStatus;
  trainerName: string | null;
  /** Per pintar la seva foto i el seu color. Null si la reserva no en té. */
  trainerId: string | null;
  trainerAvatarPath: string | null;
};

export type ClientPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
};

export type ClientDetail = ClientListItem & {
  profileId: string;
  assignedTrainerId: string | null;
  clinicalNotes: string | null;
  generalNotes: string | null;
  bonos: ClientBono[];
  reservations: ClientReservation[];
  payments: ClientPayment[];
};

export type ClientInput = {
  fullName: string;
  email: string;
  phone: string | null;
  assignedTrainerId: string | null;
  clinicalNotes: string | null;
  generalNotes: string | null;
};

// ── Helpers de simulación ──
function toListItem(clientId: string, store = getStore()): ClientListItem {
  const client = store.clients.find((c) => c.id === clientId)!;
  const profile = store.profiles.find((p) => p.id === client.profile_id);
  const trainer = client.assigned_trainer_id
    ? store.profiles.find((p) => p.id === client.assigned_trainer_id)
    : null;
  const bonos = store.bonos.filter(
    (b) =>
      b.client_id === clientId &&
      (b.status === "active" || b.status === "pending_payment") &&
      !isBonoExpired(b),
  );
  return {
    id: client.id,
    profileId: client.profile_id,
    fullName: profile?.full_name ?? "—",
    email: profile?.email ?? "",
    phone: profile?.phone ?? null,
    trainerName: trainer?.full_name ?? null,
    activeBonos: bonos.length,
    remainingSessions: bonos.reduce((s, b) => s + b.remaining_sessions, 0),
  };
}

/** Clients per pàgina de la llista (admin i professional). */
export const CLIENTS_PAGE_SIZE = 50;

export type ClientsPageItem = ClientListItem & {
  /** Per marcar «el meu» a la llista del professional. */
  assignedTrainerId: string | null;
};

export type ClientsPage = {
  items: ClientsPageItem[];
  nextCursor: string | null;
  /** Quants en surten amb aquests filtres. Només a la primera pàgina. */
  total: number | null;
};

// El cursor va dins d'un filtre de PostgREST: el nom, entre cometes i escapat;
// l'id, només lletres, xifres i guions.
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeClientsCursor(item: { fullName: string | null; profileId: string }): string {
  return Buffer.from(JSON.stringify([item.fullName, item.profileId])).toString("base64url");
}

function decodeClientsCursor(c: string): { name: string | null; id: string } | null {
  try {
    const v = JSON.parse(Buffer.from(c, "base64url").toString("utf8"));
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [name, id] = v;
    if (name !== null && (typeof name !== "string" || name.length > 200)) return null;
    if (typeof id !== "string" || !SAFE_ID.test(id)) return null;
    return { name, id };
  } catch {
    return null;
  }
}

/** Un valor dins d'un filtre `or=(...)` de PostgREST, entre cometes. */
function pgrstQuote(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Els dígits a buscar al telèfon, NOMÉS si el que s'ha escrit sembla un
 * telèfon (xifres, espais, +, -, parèntesis) i en porta almenys tres. Abans
 * qualsevol xifra valia: «ana42@» buscava «42» a tots els telèfons i en treia
 * mitja llista.
 */
function phoneDigits(q: string): string | null {
  if (!/^[\d\s+\-()]+$/.test(q)) return null;
  const d = digitsOnly(q);
  return d.length >= 3 ? d : null;
}

/**
 * La cerca: totes les paraules al nom (sense accents ni majúscules, en
 * qualsevol ordre, com `ClientSearch`), O un tros del correu, O els dígits del
 * telèfon si el que s'ha escrit és un telèfon (tant si està desat pelat com
 * amb espais o prefix). Només dades del
 * propi client: cercar «Laia» no torna els clients de la Laia.
 */
function searchCondition(q: string): string {
  const parts: string[] = [];
  const words = nameWords(q);
  if (words.length)
    parts.push(`and(${words.map((w) => `full_name.imatch.${pgrstQuote(wordRegex(w))}`).join(",")})`);
  parts.push(`email.ilike.${pgrstQuote(`*${q}*`)}`);
  const d = phoneDigits(q);
  if (d) parts.push(`phone.imatch.${pgrstQuote(d.split("").join("\\D*"))}`);
  return `or(${parts.join(",")})`;
}

function matchesQuery(c: { fullName: string; email: string; phone: string | null }, q: string): boolean {
  if (matchesName(c.fullName, q)) return true;
  if (foldName(c.email).includes(foldName(q))) return true;
  const d = phoneDigits(q);
  return d !== null && digitsOnly(c.phone).includes(d);
}

/**
 * Una pàgina de clients, per ordre alfabètic, amb la cerca i el filtre de
 * professional fets a la BASE.
 *
 * Abans les dues llistes portaven TOTS els clients (ordenats per alta) i
 * filtraven al navegador. Al tall de 1000 files, els més nous no haurien
 * sortit, ni cercant-los. Ara: cursor sobre (nom, id), 50 per pàgina i el
 * total amb `count: exact` a la primera.
 */
export async function listClientsPage(opts: {
  q?: string;
  /** Només els assignats a aquest professional. */
  trainerId?: string | null;
  cursor?: string | null;
  limit?: number;
}): Promise<ClientsPage> {
  const limit = Math.min(Math.max(opts.limit ?? CLIENTS_PAGE_SIZE, 1), 200);
  const q = (opts.q ?? "").trim().slice(0, 60);
  const after = opts.cursor ? decodeClientsCursor(opts.cursor) : null;
  if (opts.cursor && !after) throw new Error("Cursor de clients no vàlid.");

  // Cada fila porta, a part, el nom TAL COM és a la base (null inclòs): és el
  // que ha d'anar al cursor, no el «—» que es pinta.
  let rows: { item: ClientsPageItem; rawName: string | null }[];
  let total: number | null = null;

  if (USE_MOCK) {
    const store = getStore();
    const all = store.clients
      .filter((c) => !opts.trainerId || c.assigned_trainer_id === opts.trainerId)
      .map((c) => ({ ...toListItem(c.id, store), assignedTrainerId: c.assigned_trainer_id ?? null }))
      .filter((c) => !q || matchesQuery(c, q))
      .sort((a, b) => (a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : a.profileId < b.profileId ? -1 : 1));
    total = after ? null : all.length;
    rows = all
      .filter(
        (c) =>
          !after ||
          (after.name !== null &&
            (c.fullName > after.name || (c.fullName === after.name && c.profileId > after.id))),
      )
      .slice(0, limit + 1)
      .map((item) => ({ item, rawName: item.fullName }));
  } else if (opts.trainerId && !UUID.test(opts.trainerId)) {
    // Un ?trainer= que no és un uuid (un enllaç vell o escrit a mà): Postgres
    // el rebutjaria amb un error i tombaria la pàgina. No és de ningú: cap client.
    rows = [];
    total = 0;
  } else {
    const supabase = await createClient();
    let query = supabase
      .from("profiles")
      .select(
        `id, full_name, email, phone,
         client:clients!clients_profile_id_fkey!inner(
           id, assigned_trainer_id,
           trainer:profiles!clients_assigned_trainer_id_fkey(full_name),
           bonos(remaining_sessions, status, expires_at)
         )`,
        // El total només cal a la primera pàgina; amb el cursor posat,
        // comptaria només els que queden.
        after ? undefined : { count: "exact" },
      )
      .eq("role", "client")
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(limit + 1);
    if (opts.trainerId) query = query.eq("client.assigned_trainer_id", opts.trainerId);

    const conds: string[] = [];
    if (q) conds.push(searchCondition(q));
    if (after)
      conds.push(
        after.name === null
          ? `and(full_name.is.null,id.gt.${after.id})`
          : `or(full_name.gt.${pgrstQuote(after.name)},and(full_name.eq.${pgrstQuote(after.name)},id.gt.${after.id}),full_name.is.null)`,
      );
    if (conds.length) query = query.or(`and(${conds.join(",")})`);

    const { data, error, count } = await query;
    if (error) throw error;
    total = after ? null : (count ?? null);

    type Row = {
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      client: {
        id: string;
        assigned_trainer_id: string | null;
        trainer: { full_name: string | null } | null;
        bonos: { remaining_sessions: number; status: BonoStatus; expires_at: string | null }[];
      } | null;
    };
    rows = (data as unknown as Row[]).flatMap((r) => {
      if (!r.client) return [];
      const active = r.client.bonos.filter(
        (b) =>
          (b.status === "active" || b.status === "pending_payment") &&
          !isBonoExpired({ status: b.status, expires_at: b.expires_at }),
      );
      return [
        {
          rawName: r.full_name,
          item: {
            id: r.client.id,
            profileId: r.id,
            fullName: r.full_name ?? "—",
            email: r.email ?? "",
            phone: r.phone,
            trainerName: r.client.trainer?.full_name ?? null,
            assignedTrainerId: r.client.assigned_trainer_id ?? null,
            activeBonos: active.length,
            remainingSessions: active.reduce((s, b) => s + b.remaining_sessions, 0),
          },
        },
      ];
    });
  }

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => r.item),
    nextCursor:
      rows.length > limit && last
        ? encodeClientsCursor({ fullName: last.rawName, profileId: last.item.profileId })
        : null,
    total,
  };
}

/**
 * Els clients assignats a UN professional (Inici, reserves i bons del
 * professional). La llista del centre sencera ja no passa per aquí: va per
 * pàgines amb `listClientsPage`. El professional és obligatori: amb un id buit,
 * abans el filtre desapareixia i tornava TOTS els clients del centre.
 */
export async function listClients(trainerId: string): Promise<ClientListItem[]> {
  if (!trainerId) return [];
  if (USE_MOCK) {
    const store = getStore();
    return store.clients
      .filter((c) => c.assigned_trainer_id === trainerId)
      .map((c) => toListItem(c.id, store));
  }

  const supabase = await createClient();
  const query = supabase
    .from("clients")
    .select(
      `id, profile_id,
       profile:profiles!clients_profile_id_fkey(full_name, email, phone),
       trainer:profiles!clients_assigned_trainer_id_fkey(full_name),
       bonos(remaining_sessions, status, expires_at)`,
    )
    .eq("assigned_trainer_id", trainerId)
    .order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    profile_id: string;
    profile: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    trainer: { full_name: string | null } | null;
    bonos: { remaining_sessions: number; status: BonoStatus; expires_at: string | null }[];
  };
  return (data as unknown as Row[]).map((row) => {
    // Un bo caducat no compta com a actiu encara que l'escombrat no hi hagi
    // passat: la data mana sobre l'estat desat.
    const active = row.bonos.filter(
      (b) =>
        (b.status === "active" || b.status === "pending_payment") &&
        !isBonoExpired(b),
    );
    return {
      id: row.id,
      profileId: row.profile_id,
      fullName: row.profile?.full_name ?? "—",
      email: row.profile?.email ?? "",
      phone: row.profile?.phone ?? null,
      trainerName: row.trainer?.full_name ?? null,
      activeBonos: active.length,
      remainingSessions: active.reduce((s, b) => s + b.remaining_sessions, 0),
    };
  });
}

function buildDetail(clientId: string): ClientDetail | null {
  const store = getStore();
  const client = store.clients.find((c) => c.id === clientId);
  if (!client) return null;
  return {
    ...toListItem(clientId, store),
    profileId: client.profile_id,
    assignedTrainerId: client.assigned_trainer_id,
    clinicalNotes: client.clinical_notes ?? null,
    generalNotes: client.general_notes ?? null,
    bonos: store.bonos
      .filter((b) => b.client_id === clientId)
      .map((b) => ({
        id: b.id,
        serviceType: b.service_type,
        totalSessions: b.total_sessions,
        remainingSessions: b.remaining_sessions,
        price: b.price,
        status: b.status,
        expiresAt: b.expires_at ?? null,
        subscriptionId: b.subscription_id ?? null,
        autoRenew: b.auto_renew ?? false,
        autoRenewBlock: autoRenewBlockOf(b),
      })),
    reservations: store.reservations
      .filter((r) => r.client_id === clientId)
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((r) => {
        const trainer = r.trainer_id
          ? store.profiles.find((p) => p.id === r.trainer_id)
          : null;
        return {
          id: r.id,
          scheduledAt: r.scheduled_at,
          serviceType: r.service_type,
          status: r.status,
          trainerName: trainer?.full_name ?? null,
          trainerId: r.trainer_id ?? null,
          trainerAvatarPath: trainer?.avatar_path ?? null,
        };
      }),
    payments: store.payments
      .filter((p) => p.client_id === clientId)
      .map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        paidAt: p.paid_at,
      })),
  };
}

// Ficha completa contra Supabase (id de cliente o id de perfil).
type DetailRow = {
  id: string;
  profile_id: string;
  assigned_trainer_id: string | null;
  clinical_notes: string | null;
  general_notes: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  trainer: { full_name: string | null } | null;
  bonos: {
    id: string;
    expires_at: string | null;
    service_type: ServiceType;
    total_sessions: number;
    remaining_sessions: number;
    price: number;
    status: BonoStatus;
    subscription_id: string | null;
    service_id: string | null;
    gift_voucher_id: string | null;
    auto_renew: boolean;
  }[];
  reservations: {
    id: string;
    scheduled_at: string;
    service_type: ServiceType;
    status: ReservationStatus;
    trainer_id: string | null;
    trainer: { full_name: string | null; avatar_path: string | null } | null;
  }[];
  payments: {
    id: string;
    amount: number;
    method: PaymentMethod;
    paid_at: string;
  }[];
};

async function fetchClientDetail(
  column: "id" | "profile_id",
  value: string,
): Promise<ClientDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id, profile_id, assigned_trainer_id, clinical_notes, general_notes,
       profile:profiles!clients_profile_id_fkey(full_name, email, phone),
       trainer:profiles!clients_assigned_trainer_id_fkey(full_name),
       bonos(id, service_type, total_sessions, remaining_sessions, price, status, expires_at, subscription_id, service_id, gift_voucher_id, auto_renew),
       reservations(id, scheduled_at, service_type, status, trainer_id, trainer:profiles!reservations_trainer_id_fkey(full_name, avatar_path)),
       payments(id, amount, method, paid_at)`,
    )
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const active = row.bonos.filter((b) => b.status === "active" || b.status === "pending_payment");
  return {
    id: row.id,
    fullName: row.profile?.full_name ?? "—",
    email: row.profile?.email ?? "",
    phone: row.profile?.phone ?? null,
    trainerName: row.trainer?.full_name ?? null,
    activeBonos: active.length,
    remainingSessions: active.reduce((s, b) => s + b.remaining_sessions, 0),
    profileId: row.profile_id,
    assignedTrainerId: row.assigned_trainer_id,
    clinicalNotes: row.clinical_notes,
    generalNotes: row.general_notes,
    bonos: row.bonos.map((b) => ({
      id: b.id,
      serviceType: b.service_type,
      totalSessions: b.total_sessions,
      remainingSessions: b.remaining_sessions,
      price: b.price,
      status: b.status,
      expiresAt: b.expires_at ?? null,
      subscriptionId: b.subscription_id ?? null,
      autoRenew: b.auto_renew ?? false,
      autoRenewBlock: autoRenewBlockOf(b),
    })),
    reservations: row.reservations
      .slice()
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduled_at,
        serviceType: r.service_type,
        status: r.status,
        trainerName: r.trainer?.full_name ?? null,
        trainerId: r.trainer_id ?? null,
        trainerAvatarPath: r.trainer?.avatar_path ?? null,
      })),
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paidAt: p.paid_at,
    })),
  };
}

/** Ficha completa de un cliente por su id. */
export async function getClient(id: string): Promise<ClientDetail | null> {
  if (USE_MOCK) return buildDetail(id);
  return fetchClientDetail("id", id);
}

/** Ficha del cliente que corresponde a un perfil (área cliente). */
export async function getClientByProfile(
  profileId: string,
): Promise<ClientDetail | null> {
  if (USE_MOCK) {
    const client = getStore().clients.find((c) => c.profile_id === profileId);
    return client ? buildDetail(client.id) : null;
  }
  return fetchClientDetail("profile_id", profileId);
}

/** Qui és aquest client, reduït al mínim: l'id i quan es va donar d'alta. */
export type ClientRef = { id: string; createdAt: string };

/**
 * El client d'un perfil, sense baixar-li la fitxa.
 *
 * `getClientByProfile` torna la fitxa SENCERA —bons, reserves amb el seu
 * professional, i pagaments— amb un sol `select` encadenat. Per a qui només
 * necessita saber QUIN client és, això és pagar una consulta grossa per dues
 * columnes, i es feia a cada càrrega de pantalla del client.
 *
 * L'`created_at` hi va perquè és el tall de les piloteta quan encara no s'ha
 * mirat res: qui el demana el vol gairebé sempre alhora que l'id, i demanar-lo
 * a part tornaria a llegir la mateixa fila.
 */
export async function getClientRefByProfile(
  profileId: string,
): Promise<ClientRef | null> {
  if (USE_MOCK) {
    const client = getStore().clients.find((c) => c.profile_id === profileId);
    return client ? { id: client.id, createdAt: client.created_at } : null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, created_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data ? { id: data.id, createdAt: data.created_at } : null;
}

/** Entrenadores disponibles para asignar (para los selects de formularios). */
export async function listTrainers(): Promise<{ id: string; name: string }[]> {
  if (USE_MOCK) {
    return getStore()
      .profiles.filter((p) => p.role === "trainer")
      .map((p) => ({ id: p.id, name: p.full_name ?? "—" }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainer")
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "—" }));
}

/**
 * Canvia NOMÉS l'entrenador assignat d'un client. Cap altre camp de la fila.
 *
 * Va per `service_role` a posta, i no per la sessió de qui crida. La política
 * `clients_trainer_update` (migració 0005) està acotada a `is_trainer_of(id)`
 * —els clients propis— i eixamplar-la per encabir això obriria de passada
 * l'edició de les NOTES CLÍNIQUES de qualsevol client, que és justament el que
 * no ha de canviar. Així que l'autorització viu al codi que crida (rol admin o
 * professional) i aquesta funció només sap escriure aquest camp.
 *
 * Qui la cridi ha de comprovar el rol ABANS: aquí no es comprova.
 *
 * Sí que es comprova que el destí sigui un professional de veritat, i no és
 * una floritura: `clients.assigned_trainer_id` només és una clau forana cap a
 * `profiles`, sense cap restricció de rol, i `is_trainer_of()` reparteix permís
 * mirant només `assigned_trainer_id = auth.uid()`. Assignar un client al perfil
 * d'un altre CLIENT li donaria, a l'instant, accés de professional a la seva
 * fitxa: bons, reserves, documents i notes. Mentre això era cosa només de
 * l'administració el risc era petit; obrint-ho a tots els professionals, no.
 */
export async function reassignClientTrainer(
  clientId: string,
  trainerId: string | null,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.id === clientId);
    if (!client) throw new Error("Client no trobat");
    if (trainerId) {
      const target = store.profiles.find((p) => p.id === trainerId);
      if (target?.role !== "trainer")
        throw new Error("El professional indicat no existeix.");
    }
    client.assigned_trainer_id = trainerId;
    saveStore(store);
    return;
  }

  const admin = createAdminClient();

  if (trainerId) {
    const { data: target, error: tErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", trainerId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (target?.role !== "trainer")
      throw new Error("El professional indicat no existeix.");
  }

  const { error } = await admin
    .from("clients")
    .update({ assigned_trainer_id: trainerId })
    .eq("id", clientId);
  if (error) throw error;
}

/** Crea un cliente (y su perfil). Devuelve el id del nuevo cliente. */
export async function createClientRecord(input: ClientInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const profileId = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    store.profiles.push({
      id: profileId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      role: "client",
      specialty: null,
      preferred_language: "ca",
      birth_date: null,
      height_cm: null,
      weight_kg: null,
      gender: null,
      emergency_contact: null,
      objective: null, avatar_path: null,
      created_at: createdAt,
    });
    store.clients.push({
      id: clientId,
      profile_id: profileId,
      assigned_trainer_id: input.assignedTrainerId,
      clinical_notes: input.clinicalNotes,
      general_notes: input.generalNotes,
      referral_code: null,
      referred_by_client_id: null,
      created_at: createdAt,
    });
    saveStore(store);
    return clientId;
  }

  // Crea l'usuari (el trigger crea el perfil) i li envia la invitació de marca
  // via Resend (email best-effort). Després completem telèfon i fila de client.
  const profileId = await createUserWithInvite({
    email: input.email,
    fullName: input.fullName,
    role: "client",
  });
  const admin = createAdminClient();
  await admin.from("profiles").update({ phone: input.phone }).eq("id", profileId);
  const { data: clientRow, error: insErr } = await admin
    .from("clients")
    .insert({
      profile_id: profileId,
      assigned_trainer_id: input.assignedTrainerId,
      clinical_notes: input.clinicalNotes,
      general_notes: input.generalNotes,
    })
    .select("id")
    .single();
  if (insErr || !clientRow) {
    throw new Error(insErr?.message ?? "No s'ha pogut crear el client.");
  }
  return clientRow.id;
}

/**
 * Dades editables d'un client que JA existeix: les mateixes de l'alta menys el
 * correu.
 *
 * És un `Omit` i no un comentari a posta. El correu d'un client viu a dos
 * llocs —`auth.users.email`, que és amb el que entra, i `profiles.email`, que
 * és on li arriben els avisos— i aquesta funció només sabia escriure el segon.
 * Canviar-lo aquí els separava en silenci. Traient-lo del TIPUS, el cos
 * d'aquesta funció no el pot tornar a escriure encara que algú ho intenti: ho
 * atura el compilador, no la bona voluntat de qui ho toqui d'aquí a un any.
 *
 * Canviar el correu de debò (les dues columnes i la identitat d'Auth) és una
 * operació a part i deliberada, que encara no existeix a l'app.
 */
export type ClientUpdateInput = Omit<ClientInput, "email">;

/** Actualiza los datos de un cliente existente. El correu NO s'hi toca. */
export async function updateClientRecord(
  id: string,
  input: ClientUpdateInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const client = store.clients.find((c) => c.id === id);
    if (!client) throw new Error("Client no trobat");
    client.assigned_trainer_id = input.assignedTrainerId;
    client.clinical_notes = input.clinicalNotes;
    client.general_notes = input.generalNotes;
    const profile = store.profiles.find((p) => p.id === client.profile_id);
    if (profile) {
      profile.full_name = input.fullName;
      profile.phone = input.phone;
    }
    saveStore(store);
    return;
  }

  // Real: actualizamos la fila de cliente y su perfil (RLS deja al admin).
  const supabase = await createClient();
  const { data: client, error: getErr } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", id)
    .single();
  if (getErr || !client) throw new Error("Client no trobat");

  const { error: cErr } = await supabase
    .from("clients")
    .update({
      assigned_trainer_id: input.assignedTrainerId,
      clinical_notes: input.clinicalNotes,
      general_notes: input.generalNotes,
    })
    .eq("id", id);
  if (cErr) throw cErr;

  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      phone: input.phone,
    })
    .eq("id", client.profile_id);
  if (pErr) throw pErr;
}

// ── Ajustes del propio perfil (área cliente · Configuració) ──

export type ProfileSettings = {
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: PreferredLanguage;
  birthDate: string; // YYYY-MM-DD o ""
  heightCm: string; // string para el input numérico
  weightKg: string;
  gender: Gender | "";
  emergencyContact: string;
  objective: string;
};

/** Lee los datos editables del propio perfil. */
export async function getProfileSettings(
  profileId: string,
): Promise<ProfileSettings | null> {
  const toSettings = (p: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    preferred_language: PreferredLanguage;
    birth_date: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    gender: Gender | null;
    emergency_contact: string | null;
    objective: string | null;
  }): ProfileSettings => ({
    fullName: p.full_name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    preferredLanguage: p.preferred_language,
    birthDate: p.birth_date ?? "",
    heightCm: p.height_cm != null ? String(p.height_cm) : "",
    weightKg: p.weight_kg != null ? String(p.weight_kg) : "",
    gender: p.gender ?? "",
    emergencyContact: p.emergency_contact ?? "",
    objective: p.objective ?? "",
  });

  if (USE_MOCK) {
    const p = getStore().profiles.find((x) => x.id === profileId);
    return p ? toSettings(p) : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "full_name, email, phone, preferred_language, birth_date, height_cm, weight_kg, gender, emergency_contact, objective",
    )
    .eq("id", profileId)
    .single();
  if (error || !data) return null;
  return toSettings(data);
}

export type ProfileSettingsInput = {
  fullName: string;
  phone: string | null;
  preferredLanguage: PreferredLanguage;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  gender: Gender | null;
  emergencyContact: string | null;
  objective: string | null;
};

/**
 * Actualiza el propio perfil. El email NO se toca porque es el de login. La RLS
 * de `profiles_update` solo deja modificar la propia fila (id = auth.uid());
 * aun así filtramos por `profileId`.
 */
export async function updateProfileSettings(
  profileId: string,
  input: ProfileSettingsInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const p = store.profiles.find((x) => x.id === profileId);
    if (!p) throw new Error("Perfil no trobat.");
    p.full_name = input.fullName;
    p.phone = input.phone;
    p.preferred_language = input.preferredLanguage;
    p.birth_date = input.birthDate;
    p.height_cm = input.heightCm;
    p.weight_kg = input.weightKg;
    p.gender = input.gender;
    p.emergency_contact = input.emergencyContact;
    p.objective = input.objective;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      phone: input.phone,
      preferred_language: input.preferredLanguage,
      birth_date: input.birthDate,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      gender: input.gender,
      emergency_contact: input.emergencyContact,
      objective: input.objective,
    })
    .eq("id", profileId);
  if (error) throw error;
}
