/**
 * Què pot reservar, cancel·lar i marcar fet un professional per a un client
 * que no és seu (tiquet d'en Raul, 8/10; decisions d'en Marc, 12/10/2026; 0107):
 *
 *   npm run staffscope:check
 *
 * Dues parts:
 *
 *   1. La regla pura (`staffBookingScope`), cas per cas.
 *   2. El camí sencer en simulació, com a professional (la Laia, entrenadora):
 *      `createReservation`, `cancelReservation` i `completeReservation`, mirant
 *      al store si han escrit o no. Els clients: l'Ana és de la Laia, la Marta
 *      d'en Jordi (fisio) i l'Oriol no té ningú.
 *
 *   3. Bons (0108): un bo de GRUP a un client que no és seu, sí; un altre bo,
 *      no. I el bo baix d'un client SENSE professional surt a l'Inici de
 *      l'admin.
 *
 * «Demo amb demo» el prova `npm run demo:check`. Treballa sobre el fitxer de la
 * simulació i el deixa tal com era.
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

(globalThis as { __mockRole?: string }).__mockRole = "trainer";

const { staffBookingScope } = await import("../lib/booking-scope");
const { getStore, saveStore } = await import("../lib/mock/store");
const { createReservation, cancelReservation, completeReservation } = await import(
  "../lib/data/reservations"
);
const { datetimeLocalToInstant } = await import("../lib/center-time");
const bonosTrainer = await import("../app/(trainer)/trainer/bonos/actions");
const { getAdminDashboard } = await import("../lib/data/dashboard");
const { RedirectSignal } = await import("./shims/next-navigation");

let bad = 0;
const check = (nom: string, ok: boolean, detall = "") => {
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${nom}${detall ? ` — ${detall}` : ""}`);
};

// ─── 1. La regla pura ───────────────────────────────────────────────────────
console.log("\n1. staffBookingScope\n");
const base = {
  isOwnClient: false,
  serviceType: "ep_individual" as const,
  trainerId: "jo",
  viewerId: "jo",
  viewerSpecialty: "entrenador" as const,
  courtesy: false,
};
const casos: [string, Parameters<typeof staffBookingScope>[0], string][] = [
  ["client seu, qualsevol servei, agenda d'un altre, cortesia", { ...base, isOwnClient: true, serviceType: "fisioterapia", trainerId: "altre", courtesy: true }, "ok"],
  ["grup, client d'un altre, agenda d'un altre", { ...base, serviceType: "grupo_reducido", trainerId: "altre" }, "ok"],
  ["grup de cortesia a un client d'un altre", { ...base, serviceType: "grupo_reducido", courtesy: true }, "courtesyNotYours"],
  ["entrenador, individual, la seva agenda", base, "ok"],
  ["entrenador, parelles, la seva agenda", { ...base, serviceType: "ep_parejas" }, "ok"],
  ["entrenador, individual, agenda d'un altre", { ...base, trainerId: "altre" }, "otherAgenda"],
  ["entrenador, fisio, la seva agenda", { ...base, serviceType: "fisioterapia" }, "notYourSpecialty"],
  ["fisio, fisio, la seva agenda", { ...base, serviceType: "fisioterapia", viewerSpecialty: "fisioterapeuta" }, "ok"],
  ["fisio, individual, la seva agenda", { ...base, viewerSpecialty: "fisioterapeuta" }, "notYourSpecialty"],
  ["sense especialitat, individual, la seva agenda", { ...base, viewerSpecialty: null as never }, "notYourSpecialty"],
  ["sense especialitat, grup", { ...base, serviceType: "grupo_reducido", viewerSpecialty: null as never }, "ok"],
  ["especialitat de cortesia a un client d'un altre", { ...base, courtesy: true }, "courtesyNotYours"],
];
for (const [nom, input, esperat] of casos) {
  const r = staffBookingScope(input);
  check(nom, r === esperat, `${r} (esperat ${esperat})`);
}

// ─── 2. El camí sencer, en simulació ────────────────────────────────────────
console.log("\n2. Com a professional (Laia, entrenadora), en simulació\n");
try {
  {
    const s = getStore();
    // Tots dos professionals, disponibles tots els dies per a tot: la prova és
    // el permís, no la disponibilitat.
    for (const t of ["u-trainer-laia", "u-trainer-jordi"])
      for (let wd = 0; wd < 7; wd++)
        s.availability_rules.push({
          id: `ss-${t}-${wd}`, trainer_id: t, weekday: wd, start_time: "07:00", end_time: "22:00",
          valid_from: "2026-01-01", valid_until: null,
          service_types: ["ep_individual", "ep_parejas", "grupo_reducido", "fisioterapia"],
          created_at: "2026-01-01T00:00:00Z",
        } as never);
    const bo = (id: string, client: string, service: string) => ({
      id, client_id: client, service_type: service, total_sessions: 10, remaining_sessions: 10, price: 0,
      status: "active", purchased_at: "2026-01-01T00:00:00Z", expires_at: null, first_reservation_at: null,
      gift_voucher_id: null, stripe_checkout_session_id: null, subscription_id: null, subscription_cycle_start: null,
      is_subscription_extra: false, stripe_invoice_id: null, service_id: null, auto_renew: false,
      renewed_from_bono_id: null, created_at: "2026-01-01T00:00:00Z",
    });
    s.bonos.push(
      bo("ss-oriol-grup", "c-oriol", "grupo_reducido") as never,
      bo("ss-oriol-fisio", "c-oriol", "fisioterapia") as never,
      bo("ss-marta-grup", "c-marta", "grupo_reducido") as never,
      bo("ss-marta-fisio", "c-marta", "fisioterapia") as never,
    );
    saveStore(s);
  }

  // Una hora diferent per prova: el client no pot ser a dos llocs alhora (0105).
  let dia = 20;
  const quan = () => {
    const d = new Date(Date.now() + dia++ * 86_400_000).toISOString().slice(0, 10);
    return datetimeLocalToInstant(`${d}T10:00`)!.toISOString();
  };
  const nReserves = () => getStore().reservations.length;
  const intenta = async (fn: () => Promise<unknown>): Promise<string> => {
    try {
      await fn();
      return "ok";
    } catch (e) {
      return (e as Error).message;
    }
  };
  const reserva = async (
    nom: string,
    input: Parameters<typeof createReservation>[0],
    hauria: boolean,
  ) => {
    const n0 = nReserves();
    const r = await intenta(() => createReservation(input));
    const escriu = nReserves() > n0;
    check(nom, escriu === hauria, `${escriu ? "ha reservat" : "no"} · ${r.slice(0, 90)}`);
  };

  await reserva("individual a l'Oriol (sense ningú), amb bo, la seva agenda", {
    trainerId: "u-trainer-laia", scheduledAt: quan(), bonoId: "b-5",
  }, true);
  await reserva("individual a l'Oriol, amb bo, a l'agenda d'en Jordi", {
    trainerId: "u-trainer-jordi", scheduledAt: quan(), bonoId: "b-5",
  }, false);
  await reserva("grup a l'Oriol, amb bo, al grup d'en Jordi", {
    trainerId: "u-trainer-jordi", scheduledAt: quan(), bonoId: "ss-oriol-grup",
  }, true);
  await reserva("grup de cortesia a l'Oriol, la seva agenda", {
    trainerId: "u-trainer-laia", scheduledAt: quan(), bonoId: null, clientId: "c-oriol", serviceType: "grupo_reducido",
  }, false);
  await reserva("fisio a l'Oriol, amb bo, la seva agenda (no és la seva especialitat)", {
    trainerId: "u-trainer-laia", scheduledAt: quan(), bonoId: "ss-oriol-fisio",
  }, false);
  await reserva("fisio de cortesia a l'Ana (seva), a l'agenda d'en Jordi", {
    trainerId: "u-trainer-jordi", scheduledAt: quan(), bonoId: null, clientId: "c-ana", serviceType: "fisioterapia",
  }, true);

  // Cancel·lar i marcar feta: reserves de la Marta (d'en Jordi) posades a mà.
  const posa = (id: string, service: string, trainer: string, bono: string) => {
    const s = getStore();
    const at = quan();
    s.reservations.push({
      id, client_id: "c-marta", bono_id: bono, trainer_id: trainer, scheduled_at: at,
      duration_minutes: 60, ends_at: new Date(new Date(at).getTime() + 3_600_000).toISOString(),
      service_type: service, status: "booked", series_id: null, is_complimentary: false,
      cancelled_by_center: false, created_at: new Date().toISOString(),
    } as never);
    saveStore(s);
  };
  const estat = (id: string) => getStore().reservations.find((r) => r.id === id)?.status;

  posa("ss-r-grup", "grupo_reducido", "u-trainer-jordi", "ss-marta-grup");
  posa("ss-r-fisio", "fisioterapia", "u-trainer-jordi", "ss-marta-fisio");
  posa("ss-r-fisio-laia", "fisioterapia", "u-trainer-laia", "ss-marta-fisio");
  posa("ss-r-fisio-jordi", "fisioterapia", "u-trainer-jordi", "ss-marta-fisio");

  let r = await intenta(() => cancelReservation("ss-r-grup"));
  check("cancel·lar el grup de la Marta a l'agenda d'en Jordi", estat("ss-r-grup") === "cancelled", r);
  r = await intenta(() => cancelReservation("ss-r-fisio"));
  check("cancel·lar la fisio de la Marta a l'agenda d'en Jordi (no)", estat("ss-r-fisio") === "booked", r.slice(0, 90));
  r = await intenta(() => completeReservation("ss-r-fisio-laia"));
  check("marcar feta una sessió de la Marta a la SEVA agenda", estat("ss-r-fisio-laia") === "completed", r);
  r = await intenta(() => completeReservation("ss-r-fisio-jordi"));
  check("marcar feta una sessió de la Marta a l'agenda d'en Jordi (no)", estat("ss-r-fisio-jordi") === "booked", r.slice(0, 90));

  // ─── 3. Bons ──────────────────────────────────────────────────────────────
  console.log("\n3. Bons (0108) i l'Inici de l'admin\n");
  const s0 = getStore();
  const grup = s0.services.find((x) => x.service_type === "grupo_reducido" && x.active && !x.subscription_only);
  const ep = s0.services.find((x) => x.service_type === "ep_individual" && x.active && !x.subscription_only);
  if (!grup || !ep) throw new Error("La llavor no té paquets de grup i d'EP actius.");
  const nBonos = (client: string) => getStore().bonos.filter((b) => b.client_id === client).length;
  const fdBo = (serviceType: string, serviceId: string) => {
    const f = new FormData();
    f.append("serviceType", serviceType);
    f.append("serviceId", serviceId);
    f.append("totalSessions", "4");
    f.append("price", "100");
    return f;
  };
  const crea = async (client: string, serviceType: string, serviceId: string) => {
    try {
      const r = await bonosTrainer.createTrainerBonoAction(client, {}, fdBo(serviceType, serviceId));
      return r && "error" in r && r.error ? r.error : "ok";
    } catch (e) {
      return e instanceof RedirectSignal ? "ok" : (e as Error).message;
    }
  };
  let n0 = nBonos("c-marta");
  r = await crea("c-marta", "grupo_reducido", grup.id);
  check("bo de grup a la Marta (d'en Jordi)", nBonos("c-marta") === n0 + 1, r);
  n0 = nBonos("c-marta");
  r = await crea("c-marta", "ep_individual", ep.id);
  check("bo d'EP a la Marta (no)", nBonos("c-marta") === n0, r);
  n0 = nBonos("c-marta");
  r = await crea("c-marta", "grupo_reducido", ep.id);
  check("bo «de grup» amb un paquet d'EP a la Marta (no)", nBonos("c-marta") === n0, r);
  n0 = nBonos("c-ana");
  r = await crea("c-ana", "ep_individual", ep.id);
  check("bo d'EP a l'Ana (seva), com sempre", nBonos("c-ana") === n0 + 1, r);

  // L'Oriol no té professional: el seu bo baix ha de sortir a l'admin.
  {
    const s = getStore();
    s.bonos.find((b) => b.id === "b-5")!.remaining_sessions = 1;
    saveStore(s);
  }
  (globalThis as { __mockRole?: string }).__mockRole = "admin";
  const dash = await getAdminDashboard();
  check(
    "bo baix d'un client sense professional a l'Inici de l'admin",
    dash.lowBonos.some((b) => b.clientId === "c-oriol"),
    dash.lowBonos.map((b) => b.clientName).join(", "),
  );
} catch (e) {
  bad++;
  console.error(e);
} finally {
  restaura();
}

console.log(bad ? `\n${bad} casos no fan el que han de fer.\n` : "\nTot correcte.\n");
process.exit(bad ? 1 : 0);
