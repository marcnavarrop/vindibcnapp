/**
 * Comprova que l'assistent de sèries compta TOTS els bons del client.
 *
 *   npm run series:bonos
 *
 * QUÈ ES COMPROVA I PER QUÈ
 *
 * El consum d'una reserva és FIFO: `createClientReservation` tria el bo més
 * antic amb sessions. Una SÈRIE, però, són N reserves, i cada una torna a
 * triar: quan el bo vell s'acaba, la següent segueix pel del cicle tota sola.
 * FIFO no vol dir "un bo", vol dir l'ORDRE en què s'esgoten.
 *
 * El sostre de la sèrie es calculava en dos llocs independents i tots dos es
 * quedaven amb el PRIMER de la cua. Amb un bo vell de 2 sessions al davant,
 * l'assistent deia "et queden 2" i amagava el bo sencer del cicle de la
 * subscripció —i també la sessió extra, que ja està pagada—. Prometia menys
 * del que el servidor hauria reservat.
 *
 * Aquesta és la tercera vegada que caçem el mateix patró: una PROMESA de la
 * pantalla que no coincideix amb l'EXECUCIÓ del motor. Per això no n'hi ha
 * prou de comprovar el càlcul: el bloc D planifica i DESPRÉS reserva de
 * veritat, i exigeix que els dos números i els bons consumits quadrin.
 *
 * Va en simulació perquè necessita un client amb dos bons simultanis, i la
 * rama mock i la real comparteixen la mateixa tria dins de `loadContext`.
 * El fitxer del store es desa a l'inici i es restaura al final: qui tingui
 * una sessió de mock oberta no ha de notar que això ha passat.
 */
process.env.NEXT_PUBLIC_USE_MOCK = "true";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STORE = path.join(os.tmpdir(), "vindibcn-mock.json");
const abans = fs.existsSync(STORE) ? fs.readFileSync(STORE, "utf8") : null;
const restaura = () => {
  if (abans === null) fs.rmSync(STORE, { force: true });
  else fs.writeFileSync(STORE, abans);
};

const { getStore, saveStore } = await import("../lib/mock/store");
const { resolveSeries } = await import("../lib/data/booking-series");
const { getClientCenterData } = await import("../lib/data/client-calendar");
const { createClientReservation } = await import("../lib/data/reservations");
const { canRepeatInSeries } = await import("../lib/series-rules");
const { centerLocalToInstant, centerDateStr, centerWeekday } = await import(
  "../lib/center-time"
);

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

/**
 * El primer dimecres a les 18:00 d'aquí a tres setmanes.
 *
 * Es calcula i no es clava: amb una data fixa, aquesta prova aniria caducant
 * sola i un bon dia fallaria per vella, no per cap regressió. Dimecres perquè
 * la Laia hi té tarda (17-20 h) i cau dins del dilluns-divendres de la llavor.
 */
function primerDimecres(): string {
  const d = new Date(Date.now() + 21 * 86_400_000);
  while (centerWeekday(d) !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return centerLocalToInstant(centerDateStr(d), "18:00").toISOString();
}
const FIRST_AT = primerDimecres();

type Svc = "grupo_reducido" | "ep_individual";
const BASE = {
  client_id: "c-pau", price: 200, status: "active" as const, expires_at: null,
  first_reservation_at: null, gift_voucher_id: null, subscription_cycle_start: null,
  stripe_checkout_session_id: null, stripe_invoice_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

/** Deixa en Pau amb exactament aquests bons d'aquest servei, i sense reserves. */
function setup(svc: Svc, bons: { id: string; n: number; at: string; extra?: boolean }[]) {
  const store = getStore();
  store.bonos = store.bonos.filter((b) => b.client_id !== "c-pau");
  for (const b of bons)
    store.bonos.push({
      ...BASE, id: b.id, service_type: svc,
      remaining_sessions: b.n, total_sessions: b.n, purchased_at: b.at,
      subscription_id: b.extra === undefined ? null : "sub-1",
      is_subscription_extra: b.extra ?? false,
    } as never);
  store.reservations = store.reservations.filter((r) => r.client_id !== "c-pau");
  store.booking_series = [];
  saveStore(store);
}

const req = (serviceType: Svc, occurrenceCount: number) => ({
  profileId: "u-client-pau", trainerId: "u-trainer-laia", serviceType,
  firstAt: FIRST_AT, frequency: "weekly" as const, occurrenceCount, endDate: null,
  bookOnlyAvailable: false, allowAlternatives: false, allowWaitlist: false,
});

const VELL = { id: "b-vell", n: 2, at: "2026-01-01T00:00:00.000Z" };
const CICLE = { id: "b-cicle", n: 8, at: "2026-09-01T00:00:00.000Z", extra: false };

try {
  // ───── A. Bo vell quasi esgotat + bo del cicle de la subscripció ─────
  console.log("\n1. Un bo vell de 2 sessions no pot amagar el bo del cicle");
  setup("grupo_reducido", [VELL, CICLE]);
  {
    const data = await getClientCenterData("u-client-pau");
    const plan = await resolveSeries(req("grupo_reducido", 8));
    const conf = plan.occurrences.filter((o) => o.status === "confirmada").length;
    check(data.bonoSessions.grupo_reducido === 10, "l'etiqueta del pas 1 diu 10 (2 + 8), no 2");
    check(plan.sessionsRemaining === 10, "el pla compta les 10 sessions del client");
    check(conf === 8 && plan.skippedForBono === 0, "confirma les 8 demanades, cap saltada pel bo");
    check(plan.bonoId === "b-vell", "bonoId segueix sent el primer de la cua: és metadada, no sostre");
  }

  // ───── B. La sessió extra de la subscripció, que ja està pagada ─────
  console.log("\n2. La sessió extra ja pagada també es pot programar");
  setup("grupo_reducido", [
    CICLE,
    { id: "b-extra", n: 1, at: "2026-09-10T00:00:00.000Z", extra: true },
  ]);
  {
    const data = await getClientCenterData("u-client-pau");
    const plan = await resolveSeries(req("grupo_reducido", 9));
    const conf = plan.occurrences.filter((o) => o.status === "confirmada").length;
    check(data.bonoSessions.grupo_reducido === 9, "l'etiqueta compta el cicle i l'extra (8 + 1)");
    check(plan.sessionsRemaining === 9 && conf === 9, "la novena és programable i no queda fora");
  }

  // ───── C. El sostre segueix existint quan de debò s'acaben ─────
  console.log("\n3. El sostre no ha desaparegut: només té el denominador bo");
  setup("grupo_reducido", [VELL, CICLE]);
  {
    const plan = await resolveSeries(req("grupo_reducido", 12));
    const conf = plan.occurrences.filter((o) => o.status === "confirmada").length;
    check(conf === 10, "amb 10 disponibles i 12 demanades, en confirma 10");
    check(plan.skippedForBono === 2, "i diu que 2 queden fora");
  }

  // ───── D. Promesa contra execució, que és el bug que ens va portar aquí ─────
  console.log("\n4. El que promet el pla és el que el motor reserva de veritat");
  check(!canRepeatInSeries("grupo_reducido"), "les sèries de grup segueixen tancades per aforament (fd610d1)");
  check(canRepeatInSeries("ep_individual"), "les individuals sí que admeten sèrie");
  setup("ep_individual", [VELL, CICLE]);
  {
    const plan = await resolveSeries(req("ep_individual", 8));
    const decided = plan.occurrences.filter((o) => o.status === "confirmada");
    check(plan.sessionsRemaining === 10 && decided.length === 8, "el pla promet les 8");

    let fetes = 0;
    for (const o of decided) {
      try {
        await createClientReservation({
          profileId: "u-client-pau", trainerId: "u-trainer-laia",
          serviceType: "ep_individual", scheduledAt: o.requestedAt,
        });
        fetes++;
      } catch (e) {
        console.log(`    · ${o.requestedAt}: ${(e as Error).message}`);
      }
    }
    const s = getStore();
    const bo = (id: string) => s.bonos.find((b) => b.id === id)!;
    const consumits = s.reservations
      .filter((r) => r.client_id === "c-pau")
      .map((r) => r.bono_id);
    check(fetes === 8, `el motor crea les 8 que el pla havia promès (n'ha fet ${fetes})`);
    check(
      consumits.filter((b) => b === "b-vell").length === 2 &&
        consumits.filter((b) => b === "b-cicle").length === 6,
      "i les reparteix FIFO: 2 del vell i 6 del cicle",
    );
    check(
      bo("b-vell").remaining_sessions === 0 && bo("b-cicle").remaining_sessions === 2,
      "els bons queden a 0 i 2, que és el que diuen les reserves",
    );
  }
} finally {
  restaura();
}

console.log(
  fallides === 0
    ? "\n✓ L'assistent de sèries compta tots els bons, i promet el que el motor fa."
    : `\n✗ ${fallides} comprovacions fallides.`,
);
process.exit(fallides === 0 ? 0 : 1);
