/**
 * Comprova tres coses de la llista d'espera, en simulació:
 *
 *   npm run waitlist:check
 *
 *   · D — Mai es promociona a una sessió que ja ha passat (l'equip pot
 *     cancel·lar-ne una de passada, i això cridava la promoció).
 *   · C — La reserva que surt d'una espera de SÈRIE és de la sèrie: cancel·lar
 *     la sèrie la cancel·la i torna la sessió al bo.
 *   · La sessió que entra des de la cua no compta DOS cops per al total de la
 *     sèrie (la reserva i l'espera complerta): l'allargament no s'atura abans.
 *   · Les esperes d'una sessió passada caduquen ('expired') i deixen tancar la
 *     sèrie que només tenia aquestes.
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
const { createClientReservation, cancelClientReservation } = await import("../lib/data/reservations");
const { promoteFromWaitlist, listWaitlistForClient } = await import("../lib/data/waitlist");
const { resolveSeries, commitSeries, listActiveSeries, cancelSeries } = await import(
  "../lib/data/booking-series"
);
const { extendSeriesForSubscription } = await import("../lib/data/series-extension");
const { centerLocalToInstant, centerDateStr, centerWeekday, addDaysStr, centerToday } = await import(
  "../lib/center-time"
);

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

// ─── Dades pròpies (prefix wl-), sobre la llavor ────────────────────────────
const RAUL = "wl-u-raul";
const PERE = { profile: "wl-u-pere", client: "wl-c-pere", bono: "wl-b-pere" };
const MARTA = { profile: "wl-u-marta", client: "wl-c-marta", bono: "wl-b-marta" };
const NOW = "2026-01-01T00:00:00.000Z";

/** Un dilluns d'aquí a dues setmanes i escaig, en hora del centre. */
function dia(): string {
  const d = new Date(Date.now() + 15 * 86_400_000);
  while (centerWeekday(d) !== 0) d.setUTCDate(d.getUTCDate() + 1);
  return centerDateStr(d);
}
const DIA = dia();
const at = (hhmm: string, dies = 0) => centerLocalToInstant(addDaysStr(DIA, dies), hhmm).toISOString();
const sessions = (b: string) => getStore().bonos.find((x) => x.id === b)!.remaining_sessions;

function seed() {
  const s = getStore();
  const prof = (id: string, name: string, role: string) => ({
    id, full_name: name, email: `${id}@example.com`, phone: null, role, specialty: null,
    preferred_language: "ca", birth_date: null, height_cm: null, weight_kg: null,
    gender: null, emergency_contact: null, objective: null, avatar_path: null, created_at: NOW,
  });
  s.profiles.push(
    prof(RAUL, "Raul Espera", "trainer") as never,
    prof(PERE.profile, "Pere Espera", "client") as never,
    prof(MARTA.profile, "Marta Espera", "client") as never,
  );
  const client = (c: typeof PERE) => ({
    id: c.client, profile_id: c.profile, assigned_trainer_id: RAUL, clinical_notes: null,
    general_notes: null, referral_code: null, referred_by_client_id: null, created_at: NOW,
  });
  s.clients.push(client(PERE) as never, client(MARTA) as never);
  const bono = (c: typeof PERE) => ({
    id: c.bono, client_id: c.client, service_type: "ep_individual", total_sessions: 20,
    remaining_sessions: 10, price: 0, status: "active", purchased_at: NOW, expires_at: null,
    first_reservation_at: null, gift_voucher_id: null, stripe_checkout_session_id: null,
    subscription_id: null, subscription_cycle_start: null, is_subscription_extra: false,
    stripe_invoice_id: null, service_id: null, auto_renew: false, renewed_from_bono_id: null,
    created_at: NOW,
  });
  s.bonos.push(bono(PERE) as never, bono(MARTA) as never);
  for (let wd = 0; wd < 7; wd++)
    s.availability_rules.push({
      id: `wl-r-${wd}`, trainer_id: RAUL, weekday: wd, start_time: "08:00", end_time: "21:00",
      valid_from: "2026-01-01", valid_until: null, service_types: ["ep_individual"], created_at: NOW,
    } as never);
  saveStore(s);
}

/** La Marta ocupa l'hora tres setmanes seguides i el Pere en fa una sèrie a la cua. */
async function serieALaCua(hhmm: string): Promise<string> {
  for (const w of [0, 7, 14])
    await createClientReservation({
      profileId: MARTA.profile, trainerId: RAUL, serviceType: "ep_individual", scheduledAt: at(hhmm, w),
    });
  const req = {
    profileId: PERE.profile, trainerId: RAUL, serviceType: "ep_individual" as const,
    firstAt: at(hhmm), frequency: "weekly" as const, occurrenceCount: 3, endDate: null,
    bookOnlyAvailable: false, allowAlternatives: false, allowWaitlist: true,
  };
  const plan = await resolveSeries(req);
  const res = await commitSeries(req, plan.occurrences);
  check(res.waitlisted === 3 && res.created === 0, `(preparació) sèrie de les ${hhmm}: 3 setmanes a la cua`);
  return res.seriesId;
}

try {
  seed();

  console.log("\nC. La plaça que arriba a una sèrie és de la sèrie");
  const s1 = await serieALaCua("10:00");
  const marta = getStore().reservations.find(
    (r) => r.client_id === MARTA.client && r.scheduled_at === at("10:00"),
  )!;
  const abansPromo = sessions(PERE.bono);
  await cancelClientReservation(MARTA.profile, marta.id);
  const promo = getStore().reservations.find(
    (r) => r.client_id === PERE.client && r.scheduled_at === at("10:00") && r.status === "booked",
  );
  check(!!promo && sessions(PERE.bono) === abansPromo - 1, "la Marta cancel·la i el Pere hi entra (sessió descomptada)");
  check(promo?.series_id === s1, "la reserva nova porta el series_id de la sèrie");
  const out = await cancelSeries(PERE.profile, s1, PERE.client);
  const despres = getStore().reservations.find((r) => r.id === promo?.id);
  check(out.cancelled === 1 && despres?.status === "cancelled", "cancel·lar la sèrie la cancel·la");
  check(sessions(PERE.bono) === abansPromo, "i la sessió torna al bo");
  check(
    getStore().waitlist_entries.filter((w) => w.series_id === s1 && w.status === "waiting").length === 0,
    "les altres esperes de la sèrie queden cancel·lades",
  );

  console.log("\nD. Mai es promociona a una hora passada");
  {
    const s = getStore();
    const ahir = addDaysStr(centerToday(), -2);
    s.waitlist_entries.push({
      id: "wl-w-passada", client_id: PERE.client, bono_id: PERE.bono, service_type: "ep_individual",
      trainer_id: RAUL, desired_date: ahir, desired_time: "10:00:00", series_id: null,
      status: "waiting", created_at: NOW, fulfilled_at: null, fulfilled_reservation_id: null,
      cancelled_by_center: false,
    } as never);
    saveStore(s);
    const bo = sessions(PERE.bono);
    const r = await promoteFromWaitlist({
      trainerId: RAUL,
      scheduledAt: centerLocalToInstant(ahir, "10:00").toISOString(),
      serviceType: "ep_individual",
    });
    check(!r.promoted, `l'equip allibera una sessió de fa dos dies i no entra ningú (${r.promoted ? "promocionat" : r.reason})`);
    check(sessions(PERE.bono) === bo, "el bo no es toca");
    check(
      !getStore().reservations.some((x) => x.client_id === PERE.client && x.scheduled_at < new Date().toISOString()),
      "no es crea cap reserva al passat",
    );
  }

  console.log("\nUna sessió de la cua compta una sola vegada");
  {
    // Sèrie de 4 que s'allarga sola: 3 setmanes a la cua i la primera entra.
    const s3 = await serieALaCua("14:00");
    const s = getStore();
    const row = s.booking_series.find((x) => x.id === s3)!;
    row.auto_extend = true;
    row.occurrence_count = 4;
    saveStore(s);
    const m = getStore().reservations.find(
      (r) => r.client_id === MARTA.client && r.scheduled_at === at("14:00"),
    )!;
    await cancelClientReservation(MARTA.profile, m.id);
    check(
      getStore().reservations.some((r) => r.series_id === s3 && r.client_id === PERE.client && r.status === "booked"),
      "(preparació) la primera setmana entra des de la cua, dins de la sèrie",
    );
    const out = await extendSeriesForSubscription({ clientId: PERE.client, serviceType: "ep_individual" } as never);
    const o = out.find((x) => x.seriesId === s3);
    check(
      o?.created === 1 && !o.skipped,
      `l'allargament veu 3 de 4 i n'afegeix 1 (${o?.skipped ?? `${o?.created} creades`})`,
    );
  }

  console.log("\nCaducitat de les esperes passades");
  const s2 = await serieALaCua("12:00");
  {
    // Les tres esperes, portades al passat: com si la sèrie s'hagués fet fa un mes.
    const s = getStore();
    let i = 0;
    for (const w of s.waitlist_entries)
      if (w.series_id === s2) w.desired_date = addDaysStr(centerToday(), -21 + 7 * i++);
    saveStore(s);
  }
  const meves = await listWaitlistForClient(PERE.client);
  const deS2 = meves.filter((w) => w.seriesId === s2);
  check(deS2.length === 3 && deS2.every((w) => w.status === "expired"), "les tres esperes passades surten 'expired'");
  check(meves.find((w) => w.id === "wl-w-passada")?.status === "expired", "l'espera solta de fa dos dies, també");
  await listActiveSeries(PERE.client);
  check(
    getStore().booking_series.find((x) => x.id === s2)?.status === "completed",
    "la sèrie que només tenia esperes passades es tanca ('completed')",
  );
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
