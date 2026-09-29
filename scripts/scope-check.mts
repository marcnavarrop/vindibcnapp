/**
 * Comprova la regla d'amb qui pot reservar un client (lib/booking-scope.ts) a
 * TOTS els camins del servidor, en simulació.
 *
 *   npm run scope:check
 *
 *   · Individual i parelles: només amb l'entrenador assignat.
 *   · Grup: amb qualsevol professional que ofereixi Grup.
 *   · Fisioteràpia: amb qualsevol que ofereixi Fisioteràpia, sigui quina sigui
 *     la seva especialitat (també buida). Ningú no queda fora per l'especialitat.
 *   · Sense entrenador: ni individual ni parelles; grup i fisio, sí.
 *
 * Els camins: la reserva solta, la cua, el pla d'una sèrie i les seves
 * alternatives, el commit d'una sèrie amb ocurrències manipulades, la promoció
 * des de la cua (també d'esperes escrites saltant-se l'app), l'allargament
 * automàtic i «Les teves sèries».
 *
 * Treballa sobre el fitxer de la simulació i el deixa tal com era.
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
const scope = await import("../lib/booking-scope");
const { createClientReservation } = await import("../lib/data/reservations");
const { joinWaitlist, promoteFromWaitlist } = await import("../lib/data/waitlist");
const { resolveSeries, commitSeries, listActiveSeries } = await import(
  "../lib/data/booking-series"
);
const { extendSeriesForSubscription } = await import("../lib/data/series-extension");
const { centerLocalToInstant, centerDateStr, centerWeekday } = await import(
  "../lib/center-time"
);

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

/** Què diu el servidor: "ok" o el motiu de la regla (o un altre error). */
async function outcome(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof scope.BookingScopeError) return e.scope;
    return `altre: ${(e as Error).message}`;
  }
}

// ─── Dades pròpies (prefix sc-), sobre la llavor ────────────────────────────
const LAIA = "u-trainer-laia";
const JORDI = "u-trainer-jordi"; // fisioterapeuta
const RAUL = "sc-u-raul"; // entrenador que TAMBÉ ofereix fisio
const NEUS = "sc-u-neus"; // especialitat buida, ofereix fisio

/** Un dimarts d'aquí a dues setmanes i escaig, en hora del centre. */
function dia(): string {
  const d = new Date(Date.now() + 15 * 86_400_000);
  while (centerWeekday(d) !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return centerDateStr(d);
}
const DIA = dia();
const at = (hhmm: string, dies = 0) => {
  const d = new Date(`${DIA}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dies);
  return centerLocalToInstant(d.toISOString().slice(0, 10), hhmm).toISOString();
};

const NOW = "2026-01-01T00:00:00.000Z";
function seed() {
  const s = getStore();
  const prof = (id: string, name: string, role: string, specialty: string | null) => ({
    id, full_name: name, email: `${id}@example.com`, phone: null, role, specialty,
    preferred_language: "ca", birth_date: null, height_cm: null, weight_kg: null,
    gender: null, emergency_contact: null, objective: null, avatar_path: null, created_at: NOW,
  });
  s.profiles.push(
    prof(RAUL, "Raul Test", "trainer", "entrenador") as never,
    prof(NEUS, "Neus Test", "trainer", null) as never,
    prof("sc-u-oriol", "Oriol Sense", "client", null) as never,
    prof("sc-u-pere", "Pere DeRaul", "client", null) as never,
  );
  const client = (id: string, profile: string, assigned: string | null) => ({
    id, profile_id: profile, assigned_trainer_id: assigned, clinical_notes: null,
    general_notes: null, referral_code: null, referred_by_client_id: null, created_at: NOW,
  });
  s.clients.push(
    client("sc-c-oriol", "sc-u-oriol", null) as never,
    client("sc-c-pere", "sc-u-pere", RAUL) as never,
  );
  // Ana (c-ana) és de la Laia a la llavor; se li donen bons de tot, nets.
  const bono = (id: string, cid: string, svc: string) => ({
    id, client_id: cid, service_type: svc, total_sessions: 20, remaining_sessions: 20,
    price: 0, status: "active", purchased_at: NOW, expires_at: null,
    first_reservation_at: null, gift_voucher_id: null, stripe_checkout_session_id: null,
    subscription_id: null, subscription_cycle_start: null, is_subscription_extra: false,
    stripe_invoice_id: null, service_id: null, auto_renew: false, renewed_from_bono_id: null,
    created_at: NOW,
  });
  for (const svc of ["ep_individual", "ep_parejas", "grupo_reducido", "fisioterapia"]) {
    s.bonos.push(bono(`sc-b-ana-${svc}`, "c-ana", svc) as never);
    s.bonos.push(bono(`sc-b-oriol-${svc}`, "sc-c-oriol", svc) as never);
    s.bonos.push(bono(`sc-b-pere-${svc}`, "sc-c-pere", svc) as never);
  }
  // Tothom disponible tots els dies de 8 a 21, perquè la prova no depengui de
  // l'horari de la llavor.
  const rule = (id: string, tid: string, wd: number, svcs: string[]) => ({
    id, trainer_id: tid, weekday: wd, start_time: "08:00", end_time: "21:00",
    valid_from: "2026-01-01", valid_until: null, service_types: svcs, created_at: NOW,
  });
  for (let wd = 0; wd < 7; wd++) {
    s.availability_rules.push(
      rule(`sc-r-laia-${wd}`, LAIA, wd, ["ep_individual", "ep_parejas", "grupo_reducido"]) as never,
      rule(`sc-r-raul-${wd}`, RAUL, wd, ["ep_individual", "ep_parejas", "grupo_reducido", "fisioterapia"]) as never,
      rule(`sc-r-neus-${wd}`, NEUS, wd, ["fisioterapia"]) as never,
      rule(`sc-r-jordi-${wd}`, JORDI, wd, ["fisioterapia"]) as never,
    );
  }
  saveStore(s);
}

try {
  seed();

  console.log("\n1. La regla, sola");
  const sc = scope.clientBookingScope;
  check(sc({ serviceType: "ep_individual", trainerId: LAIA, assignedTrainerId: LAIA }) === "ok", "individual amb el seu: sí");
  check(sc({ serviceType: "ep_individual", trainerId: RAUL, assignedTrainerId: LAIA }) === "notAssignedTrainer", "individual amb un altre: no");
  check(sc({ serviceType: "ep_parejas", trainerId: RAUL, assignedTrainerId: LAIA }) === "notAssignedTrainer", "parelles amb un altre: no");
  check(sc({ serviceType: "ep_individual", trainerId: LAIA, assignedTrainerId: null }) === "noAssignedTrainer", "sense entrenador, individual: no");
  check(sc({ serviceType: "ep_parejas", trainerId: null, assignedTrainerId: null }) === "noAssignedTrainer", "sense entrenador, parelles (a la cua, «qualsevol»): no");
  check(sc({ serviceType: "grupo_reducido", trainerId: RAUL, assignedTrainerId: LAIA }) === "ok", "grup amb qualsevol: sí");
  check(sc({ serviceType: "fisioterapia", trainerId: RAUL, assignedTrainerId: null }) === "ok", "fisio sense entrenador: sí");
  check(scope.scopeErrorCode(new scope.BookingScopeError("notAssignedTrainer")) === "notYourTrainer", "codi: notYourTrainer");
  check(scope.scopeErrorCode(new scope.BookingScopeError("noAssignedTrainer")) === "noAssignedTrainer", "codi: noAssignedTrainer");
  check(scope.scopeErrorCode(new Error("x")) === null, "un altre error no és d'aquesta regla");

  const book = (profileId: string, trainerId: string, serviceType: string, when: string) =>
    outcome(createClientReservation({ profileId, trainerId, serviceType: serviceType as never, scheduledAt: when }));

  console.log("\n2. Reserva solta (createClientReservation)");
  check((await book("u-client-ana", RAUL, "ep_individual", at("09:00"))) === "notAssignedTrainer", "Ana, individual amb Raul → rebutjada");
  check((await book("u-client-ana", RAUL, "ep_parejas", at("09:00"))) === "notAssignedTrainer", "Ana, parelles amb Raul → rebutjada");
  check((await book("u-client-ana", LAIA, "ep_individual", at("09:00"))) === "ok", "Ana, individual amb la Laia (la seva) → sí");
  check((await book("u-client-ana", RAUL, "grupo_reducido", at("10:00"))) === "ok", "Ana, grup amb Raul → sí");
  check((await book("u-client-ana", RAUL, "fisioterapia", at("11:00"))) === "ok", "Ana, fisio amb Raul (especialitat «entrenador») → sí");
  check((await book("u-client-ana", NEUS, "fisioterapia", at("12:00"))) === "ok", "Ana, fisio amb Neus (especialitat buida) → sí");
  check((await book("sc-u-oriol", LAIA, "ep_individual", at("09:00"))) === "noAssignedTrainer", "Oriol (sense entrenador), individual → rebutjada");
  check((await book("sc-u-oriol", LAIA, "ep_parejas", at("09:00"))) === "noAssignedTrainer", "Oriol, parelles → rebutjada");
  check((await book("sc-u-oriol", RAUL, "grupo_reducido", at("10:00"))) === "ok", "Oriol, grup amb Raul → sí");
  check((await book("sc-u-oriol", JORDI, "fisioterapia", at("11:00"))) === "ok", "Oriol, fisio amb Jordi → sí");
  {
    const s = getStore();
    const rebutjades = s.reservations.filter(
      (r) => r.client_id === "c-ana" && r.trainer_id === RAUL && (r.service_type === "ep_individual" || r.service_type === "ep_parejas"),
    );
    const bo = s.bonos.find((b) => b.id === "sc-b-ana-ep_parejas");
    check(rebutjades.length === 0 && bo?.remaining_sessions === 20, "les rebutjades no deixen reserva ni gasten sessió");
  }

  console.log("\n3. Llista d'espera (joinWaitlist)");
  // En Pere (de Raul) ocupa Raul a les 13:00 i la Laia té la franja de les
  // 14:00 ocupada per l'Ana: dues individuals plenes.
  check((await book("sc-u-pere", RAUL, "ep_individual", at("13:00"))) === "ok", "(preparació) Pere reserva individual amb Raul a les 13:00");
  check((await book("u-client-ana", LAIA, "ep_individual", at("14:00"))) === "ok", "(preparació) Ana reserva individual amb Laia a les 14:00");
  const join = (profileId: string, trainerId: string, serviceType: string, when: string) =>
    outcome(joinWaitlist({ profileId, trainerId, serviceType: serviceType as never, scheduledAt: when }));
  check((await join("u-client-ana", RAUL, "ep_individual", at("13:00"))) === "notAssignedTrainer", "Ana a la cua d'individual de Raul → rebutjada");
  check((await join("sc-u-oriol", LAIA, "ep_individual", at("14:00"))) === "noAssignedTrainer", "Oriol a la cua d'individual de Laia → rebutjada");
  check(
    getStore().waitlist_entries.filter((w) => w.client_id === "c-ana" || w.client_id === "sc-c-oriol").length === 0,
    "cap espera escrita",
  );

  console.log("\n4. Sèries: el pla (resolveSeries)");
  const req = (profileId: string, trainerId: string, serviceType: string, firstAt: string, extra: Record<string, unknown> = {}) => ({
    profileId, trainerId, serviceType: serviceType as never, firstAt, frequency: "weekly" as const,
    occurrenceCount: 3, endDate: null, bookOnlyAvailable: false, allowAlternatives: true, allowWaitlist: false,
    ...extra,
  });
  {
    const p = await resolveSeries(req("u-client-ana", RAUL, "ep_individual", at("16:00")));
    check(p.scope === "notAssignedTrainer" && p.occurrences.length === 0, "Ana, sèrie individual amb Raul → la regla diu que no, sense cap ocurrència");
    const o = await resolveSeries(req("sc-u-oriol", LAIA, "ep_parejas", at("16:00")));
    check(o.scope === "noAssignedTrainer", "Oriol, sèrie de parelles → sense entrenador");
  }
  {
    // La Laia, bloquejada tot el dia de la segona ocurrència: l'alternativa
    // «mateixa hora, un altre professional» NO pot ser en Raul.
    const s = getStore();
    const d2 = new Date(at("16:00", 7));
    s.availability_blocks.push({
      id: "sc-k-laia", trainer_id: LAIA, reason: "prova",
      start_at: centerLocalToInstant(centerDateStr(d2), "00:00").toISOString(),
      end_at: centerLocalToInstant(centerDateStr(d2), "23:59").toISOString(),
      created_by: null, created_at: NOW,
    } as never);
    saveStore(s);
    const p = await resolveSeries(req("u-client-ana", LAIA, "ep_individual", at("16:00")));
    const segona = p.occurrences[1];
    check(!p.scope && p.occurrences.length === 3, "Ana, sèrie individual amb la Laia → es planifica");
    check(
      segona?.status !== "alternativa_proposada" || segona.alternative?.trainerId === LAIA,
      `la segona (Laia bloquejada) no proposa un altre professional (${segona?.status}${segona?.alternative ? ` amb ${segona.alternative.trainerId}` : ""})`,
    );
    check(
      p.occurrences.every((o) => !o.alternative || o.alternative.trainerId === LAIA),
      "cap alternativa d'individual amb algú que no sigui la Laia",
    );
    // En fisio, en canvi, sí: qualsevol que ofereixi Fisioteràpia.
    s.availability_blocks.push({
      id: "sc-k-jordi", trainer_id: JORDI, reason: "prova",
      start_at: centerLocalToInstant(centerDateStr(d2), "00:00").toISOString(),
      end_at: centerLocalToInstant(centerDateStr(d2), "23:59").toISOString(),
      created_by: null, created_at: NOW,
    } as never);
    saveStore(s);
    const f = await resolveSeries(req("u-client-ana", JORDI, "fisioterapia", at("17:00")));
    const alt = f.occurrences[1]?.alternative?.trainerId;
    check(
      // Qualsevol fisio que no sigui en Jordi: si la simulació té més
      // professionals (p. ex. dades de proves carregades), pot ser un altre.
      f.occurrences[1]?.status === "alternativa_proposada" &&
        !!alt &&
        alt !== JORDI &&
        getStore().availability_rules.some((r) => r.trainer_id === alt && (r.service_types ?? []).includes("fisioterapia")),
      `fisio amb Jordi bloquejat → alternativa amb un altre fisio (${alt ?? "cap"})`,
    );
  }

  console.log("\n5. Sèries: el commit amb ocurrències manipulades (commitSeries)");
  {
    // El navegador envia una espera amb Raul dins d'una sèrie individual amb la
    // Laia: no s'ha d'escriure.
    const r = req("u-client-ana", LAIA, "ep_individual", at("18:00", 21), { allowWaitlist: true });
    const res = await commitSeries(r, [
      { requestedAt: at("18:00", 21), requestedTrainerId: RAUL, status: "llista_espera" },
      { requestedAt: at("18:00", 28), requestedTrainerId: RAUL, status: "confirmada" },
    ] as never);
    const s = getStore();
    check(res.waitlisted === 0 && res.created === 0 && res.failed === 2, "espera i reserva amb Raul → totes dues fallides");
    check(!s.waitlist_entries.some((w) => w.client_id === "c-ana" && w.trainer_id === RAUL), "cap espera amb Raul");
    check(!s.reservations.some((r) => r.client_id === "c-ana" && r.trainer_id === RAUL && r.service_type === "ep_individual"), "cap reserva individual amb Raul");
    const bad = await outcome(commitSeries(req("u-client-ana", RAUL, "ep_individual", at("18:00", 35)), [] as never));
    check(bad === "notAssignedTrainer", "una sèrie demanada amb Raul no s'arriba a crear");
  }

  console.log("\n6. Promoció des de la cua (promoteFromWaitlist)");
  {
    // Raul a les 19:00, lliure. A la cua: l'Ana amb Raul (més antiga, escrita
    // directament com si s'hagués saltat l'app), l'Ana «qualsevol», l'Oriol
    // «qualsevol», i en Pere (que sí que és de Raul) el darrer.
    const s = getStore();
    const { date, time } = { date: centerDateStr(new Date(at("19:00"))), time: "19:00:00" };
    const entry = (id: string, cid: string, tid: string | null, created: string) => ({
      id, client_id: cid, bono_id: null, service_type: "ep_individual", trainer_id: tid,
      desired_date: date, desired_time: time, series_id: null, status: "waiting",
      created_at: created, fulfilled_at: null, fulfilled_reservation_id: null, cancelled_by_center: false,
    });
    s.waitlist_entries.push(
      entry("sc-w-ana", "c-ana", RAUL, "2026-01-01T00:00:00.000Z") as never,
      entry("sc-w-ana-any", "c-ana", null, "2026-01-02T00:00:00.000Z") as never,
      entry("sc-w-oriol-any", "sc-c-oriol", null, "2026-01-03T00:00:00.000Z") as never,
      entry("sc-w-pere", "sc-c-pere", RAUL, "2026-01-04T00:00:00.000Z") as never,
    );
    saveStore(s);
    const res = await promoteFromWaitlist({ trainerId: RAUL, scheduledAt: at("19:00"), serviceType: "ep_individual" });
    const after = getStore().waitlist_entries;
    check(res.promoted && res.clientId === "sc-c-pere", `entra en Pere, no l'Ana ni l'Oriol (${res.promoted ? res.clientId : res.reason})`);
    check(
      ["sc-w-ana", "sc-w-ana-any", "sc-w-oriol-any"].every((id) => after.find((w) => w.id === id)?.status === "waiting"),
      "les esperes que no passen la regla no es toquen: segueixen a la cua i caducaran soles",
    );
  }

  console.log("\n7. Allargament automàtic i «Les teves sèries»");
  {
    // Dues sèries de l'Ana que s'allarguen soles: una amb Raul (com si el
    // centre li hagués canviat l'entrenador de Raul a la Laia) i una amb la Laia.
    const s = getStore();
    const serie = (id: string, tid: string) => ({
      id, client_id: "c-ana", bono_id: null, service_type: "ep_individual", base_trainer_id: tid,
      frequency: "weekly", end_date: null, occurrence_count: 20, book_only_available: false,
      allow_alternatives: false, allow_waitlist: false, status: "active", first_at: at("20:00", 42),
      auto_extend: true, created_at: NOW,
    });
    s.booking_series.push(serie("sc-s-raul", RAUL) as never, serie("sc-s-laia", LAIA) as never);
    // Una sessió futura a cadascuna, perquè «Les teves sèries» les ensenyi.
    const res = (id: string, tid: string, sid: string) => ({
      id, client_id: "c-ana", duration_minutes: 60, ends_at: at("21:00", 42), bono_id: null,
      trainer_id: tid, scheduled_at: at("20:00", 42), service_type: "ep_individual", status: "booked",
      series_id: sid, is_complimentary: false, cancelled_by_center: false, created_at: NOW,
    });
    s.reservations.push(res("sc-x-raul", RAUL, "sc-s-raul") as never);
    s.reservations.push({ ...res("sc-x-laia", LAIA, "sc-s-laia"), scheduled_at: at("19:00", 42), ends_at: at("20:00", 42) } as never);
    saveStore(s);

    const out = await extendSeriesForSubscription({ clientId: "c-ana", serviceType: "ep_individual" } as never);
    const raul = out.find((o) => o.seriesId === "sc-s-raul");
    const laia = out.find((o) => o.seriesId === "sc-s-laia");
    check(raul?.skipped === "trainerChanged" && raul.created === 0, "la sèrie amb Raul no s'allarga (trainerChanged)");
    check(!getStore().reservations.some((r) => r.series_id === "sc-s-raul" && r.id !== "sc-x-raul"), "no es reserva res més amb Raul");
    check(laia !== undefined && laia.skipped !== "trainerChanged", `la sèrie amb la Laia sí que es pot allargar (${laia?.skipped ?? `${laia?.created} creades`})`);
    check(getStore().reservations.some((r) => r.id === "sc-x-raul" && r.status === "booked"), "la sessió ja reservada amb Raul es queda");

    const list = await listActiveSeries("c-ana");
    check(list.find((x) => x.id === "sc-s-raul")?.stoppedTrainerChanged === true, "«Les teves sèries» diu per què la de Raul s'ha aturat");
    check(list.find((x) => x.id === "sc-s-laia")?.stoppedTrainerChanged === false, "i no ho diu de la de la Laia");
  }
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(
  fallides
    ? `\n✗ ${fallides} fallades`
    : "\n✓ La regla d'amb qui es reserva es compleix a tots els camins del client.",
);
process.exit(fallides ? 1 : 0);
