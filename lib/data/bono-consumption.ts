import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { getCenterSettings } from "@/lib/data/center-settings";
import { expiryForNewBono } from "@/lib/data/bonos";
import { notify, getProfileContact } from "@/lib/notifications";
import type { ServiceType } from "@/types/database";

/**
 * Què passa cada cop que un bo gasta una sessió.
 *
 * VIU EN UN MÒDUL A PART PERQUÈ EL CRIDEN DOS FITXERS QUE JA ES BARALLEN
 *
 * Les reserves i la llista d'espera s'importen l'una a l'altra i ja hi ha un
 * import dinàmic pel mig per trencar el cicle. Posant això a `reservations.ts`
 * en faria falta un altre; aquí no depèn de cap dels dos.
 *
 * I SOBRETOT: PERQUÈ ERA CINC LLOCS I NO N'HI HAVIA CAP QUE ELS MIRÉS TOTS
 *
 * Un bo perd sessions per cinc camins —l'autoservei del client, l'alta manual
 * d'admin i professional, les sèries (que passen per l'autoservei), i la
 * promoció de la llista d'espera—. L'avís de «et queda poc» es cridava a
 * QUATRE: la promoció de la cua es va quedar fora, i qui esgotava el bo entrant
 * des de la cua no rebia res. Amb la renovació automàtica el forat hauria estat
 * el mateix, així que els cinc camins passen ara per aquesta porta.
 */

type Consumed = {
  bonoId: string;
  clientId: string;
  serviceType: ServiceType;
  /** Sessions que li queden al bo DESPRÉS de gastar-ne aquesta. */
  remaining: number;
};

/** El contacte del client, amb el seu idioma. Null si no es pot avisar. */
async function clientContact(clientId: string) {
  if (USE_MOCK) {
    const store = getStore();
    const cl = store.clients.find((c) => c.id === clientId);
    return cl ? await getProfileContact(cl.profile_id) : null;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .maybeSingle();
  return data ? await getProfileContact(data.profile_id) : null;
}

/** Aquest bo porta demanada la renovació automàtica? Es mira per clau primària. */
async function isAutoRenew(bonoId: string): Promise<boolean> {
  if (USE_MOCK)
    return getStore().bonos.find((b) => b.id === bonoId)?.auto_renew === true;
  const admin = createAdminClient();
  const { data } = await admin
    .from("bonos")
    .select("auto_renew")
    .eq("id", bonoId)
    .maybeSingle();
  return data?.auto_renew === true;
}

/**
 * Avisa el client que el bo se li acaba (best-effort). El llindar el configura
 * l'admin; es dispara només en CREUAR-LO, no cada vegada que hi és per sota.
 *
 * AMB RENOVACIÓ DEMANADA NO S'AVISA
 *
 * A qui ja sap que en tindrà un de nou, dir-li «se t'acaba» és soroll: el CTA
 * d'aquest correu és literalment «Renovar el meu bo», que és la feina que
 * justament no haurà de fer. Se n'assabentarà a zero, amb el correu de la
 * renovació.
 *
 * Es mira DESPRÉS del llindar i no abans, i importa: així la consulta corre un
 * cop per vida del bo —quan es creua— i no a cada reserva.
 *
 * No hi ha cap dubte de QUIN bo es mira. El `bonoId` és el que acaba de
 * descomptar la reserva, el que va triar el FIFO, i es consulta per clau
 * primària: amb cinc bons del mateix servei no s'hi val a endevinar, i aquí no
 * cal.
 *
 * SI LA RENOVACIÓ DESPRÉS FALLA, NO ÉS PAS SILENCI
 *
 * Si el paquet s'ha retirat del catàleg o s'ha marcat «només per subscripció»,
 * `renewExhaustedBono` no pot crear el bo nou, però tampoc deixa aquell client
 * sense cap avís: envia `bono_renewal_failed`. La supressió d'aquí només
 * evita el soroll de DOS correus quan la renovació sí que sortirà bé.
 */
async function notifyBonoLowIfNeeded(input: Consumed): Promise<void> {
  const { bonoLowThreshold } = await getCenterSettings();
  if (input.remaining !== bonoLowThreshold) return;
  if (await isAutoRenew(input.bonoId)) return;

  const c = await clientContact(input.clientId);
  if (!c) return;
  await notify({
    type: "bono_low",
    recipient: c,
    data: {
      name: c.name ?? "",
      serviceType: input.serviceType,
      // El llindar el tria l'admin i pot ser qualsevol número: el correu deia
      // «et queda 1 sessió» amb l'1 escrit a mà, i amb el llindar a 3 mentia.
      remaining: String(input.remaining),
    },
  });
}

/**
 * S'ha gastat una sessió d'aquest bo: fes el que toqui.
 *
 * Mai llança. Cap d'aquestes dues coses pot tombar una reserva que ja s'ha
 * creat: si l'avís no surt o la renovació falla, la sessió reservada segueix
 * sent vàlida i el client no se n'ha d'assabentar amb un error.
 */
export async function afterBonoConsumed(input: Consumed): Promise<void> {
  try {
    await notifyBonoLowIfNeeded(input);
  } catch (e) {
    console.error("[bo] avís de bo baix:", (e as Error).message);
  }

  if (input.remaining !== 0) return;

  try {
    await renewExhaustedBono(input.bonoId);
  } catch (e) {
    console.error("[bo] renovació automàtica:", (e as Error).message);
  }
}

/**
 * El bo s'ha esgotat: si el client ho havia demanat, en neix un de nou pendent.
 *
 * NO ÉS CAP COBRAMENT. No hi ha targeta desada ni càrrec fora de sessió: neix
 * un bo 'pending_payment' del mateix paquet i se li envia un correu perquè hi
 * entri i el pagui, amb targeta o al centre.
 *
 * LA IDEMPOTÈNCIA LA DONA LA BASE
 *
 * `renewed_from_bono_id` té un índex únic parcial (0088). Si dos camins deixen
 * el mateix bo a zero gairebé alhora, el segon INSERT rebota amb un 23505 que
 * es llegeix com «ja estava fet». Mateix criteri que l'aforament dels grups i
 * que el webhook de Stripe: entre mirar i inserir no hi ha res, i per això no
 * es mira.
 *
 * PER QUÈ ES TORNA A LLEGIR EL PAQUET DEL CATÀLEG
 *
 * El preu i les sessions surten del CATÀLEG D'AVUI, no del bo esgotat. Un bo
 * vell no ha de congelar la tarifa per sempre: el que es renova és el paquet,
 * i si el centre n'ha canviat el preu, el que es compra ara val el d'ara. Si el
 * paquet ja no hi és, o s'ha marcat «només per subscripció» (0086), no es
 * renova res: no es pot vendre solt el que el centre ha decidit no vendre.
 */
async function renewExhaustedBono(bonoId: string): Promise<void> {
  const vell = await loadExhausted(bonoId);
  if (!vell) return;

  const paquet = await loadPackage(vell.serviceId);
  if (!paquet) {
    const c = await clientContact(vell.clientId);
    if (c) {
      await notify(
        {
          type: "bono_renewal_failed",
          recipient: c,
          data: { name: c.name ?? "", serviceType: vell.serviceType },
        },
        // Obligatori: mateix criteri que bono_auto_renewed. Es queda sense
        // sessions i sense cap bo nou en camí, i no ho pot veure enlloc.
        { ignorePreferences: true },
      );
    }
    return;
  }

  const nouId = await insertRenewal(vell, paquet);
  if (!nouId) return; // Ja n'hi havia una: res a fer i res a dir.

  const c = await clientContact(vell.clientId);
  if (!c) return;
  await notify({
    type: "bono_auto_renewed",
    recipient: c,
    data: {
      name: c.name ?? "",
      serviceType: vell.serviceType,
      packageName: paquet.name,
      sessions: String(paquet.sessions),
      price: String(paquet.price),
    },
  },
  // Obligatori: el client no ha premut res per crear aquest bo, i hi ha
  // diners pendents. Mateix criteri que els avisos de subscripció.
  { ignorePreferences: true });
}

type Exhausted = {
  /** El bo esgotat. És el que enllaça la renovació amb el seu origen. */
  bonoId: string;
  clientId: string;
  serviceType: ServiceType;
  serviceId: string;
};

/** El bo esgotat, només si de debò toca renovar-lo. */
async function loadExhausted(bonoId: string): Promise<Exhausted | null> {
  if (USE_MOCK) {
    const b = getStore().bonos.find((x) => x.id === bonoId);
    if (!b || !b.auto_renew || !b.service_id) return null;
    return {
      bonoId: b.id,
      clientId: b.client_id,
      serviceType: b.service_type,
      serviceId: b.service_id,
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("bonos")
    .select("client_id, service_type, service_id, auto_renew")
    .eq("id", bonoId)
    .eq("auto_renew", true)
    .maybeSingle();
  if (!data?.service_id) return null;
  return {
    bonoId,
    clientId: data.client_id,
    serviceType: data.service_type,
    serviceId: data.service_id,
  };
}

/** El paquet d'avui, si encara es pot vendre solt. */
async function loadPackage(
  serviceId: string,
): Promise<{ name: string; sessions: number; price: number } | null> {
  if (USE_MOCK) {
    const s = getStore().services.find((x) => x.id === serviceId);
    if (!s || !s.active || s.subscription_only) return null;
    return { name: s.name, sessions: s.default_sessions, price: s.price };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("services")
    .select("name, default_sessions, price, active, subscription_only")
    .eq("id", serviceId)
    .maybeSingle();
  if (!data || !data.active || data.subscription_only) return null;
  return {
    name: data.name,
    sessions: data.default_sessions,
    price: data.price,
  };
}

/**
 * Escriu el bo de renovació. Torna el seu id, o null si ja n'hi havia un.
 *
 * El bo NOU no hereta `auto_renew`: la renovació és d'un sol salt i s'ha de
 * tornar a demanar. Encadenar-les soles seria un compromís indefinit que el
 * client no ha donat mai, i prou a prop d'una subscripció com per no fer-ho
 * per la porta del darrere.
 */
async function insertRenewal(
  vell: Exhausted,
  paquet: { name: string; sessions: number; price: number },
): Promise<string | null> {
  const expiresAt = await expiryForNewBono();

  if (USE_MOCK) {
    const store = getStore();
    // El mirall de l'índex únic parcial de la 0088: en simulació no hi ha
    // base que ho garanteixi, així que es comprova a mà.
    if (store.bonos.some((b) => b.renewed_from_bono_id === vell.bonoId))
      return null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.bonos.push({
      id,
      client_id: vell.clientId,
      service_type: vell.serviceType,
      total_sessions: paquet.sessions,
      remaining_sessions: paquet.sessions,
      price: paquet.price,
      status: "pending_payment",
      purchased_at: now,
      expires_at: expiresAt,
      first_reservation_at: null,
      gift_voucher_id: null,
      stripe_checkout_session_id: null,
      subscription_id: null,
      subscription_cycle_start: null,
      is_subscription_extra: false,
      stripe_invoice_id: null,
      service_id: vell.serviceId,
      auto_renew: false,
      renewed_from_bono_id: vell.bonoId,
      created_at: now,
    });
    saveStore(store);
    return id;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bonos")
    .insert({
      client_id: vell.clientId,
      service_type: vell.serviceType,
      total_sessions: paquet.sessions,
      remaining_sessions: paquet.sessions,
      price: paquet.price,
      status: "pending_payment",
      expires_at: expiresAt,
      service_id: vell.serviceId,
      renewed_from_bono_id: vell.bonoId,
    })
    .select("id")
    .single();

  // 23505: l'índex únic parcial de la 0088 diu que ja n'hi havia una.
  if (error?.code === "23505") return null;
  if (error || !data) throw error ?? new Error("No s'ha pogut renovar el bo.");
  return data.id;
}
