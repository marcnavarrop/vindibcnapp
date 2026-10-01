/**
 * Qui pot fer servir les accions de servidor que escriuen amb la clau de
 * servei, en simulació:
 *
 *   npm run roles:check
 *
 * Una acció de servidor es pot invocar pel seu id des de qualsevol pàgina: el
 * middleware de /admin/* no la protegeix. Aquí es criden les accions
 * directament, amb el rol de la cookie de la simulació (client = Ana,
 * professional = Laia, admin), i es mira al store si han ESCRIT o no. Mateixa
 * comprovació que faria una petició feta a mà, sense passar per Next.
 *
 * Els `next/headers`, `next/cache` i `next/navigation` són stubs
 * (scripts/shims, scripts/tsconfig.roles.json). La simulació no té RLS: el que
 * es prova és la barrera de l'acció, que és l'única quan s'escriu amb la clau
 * de servei.
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

type Role = "client" | "trainer" | "admin";
const as = (r: Role) => ((globalThis as { __mockRole?: string }).__mockRole = r);

const { getStore, saveStore } = await import("../lib/mock/store");
const { RedirectSignal } = await import("./shims/next-navigation");
const ofertes = await import("../app/(admin)/admin/ofertes/actions");
const entrenadors = await import("../app/(admin)/admin/entrenadors/actions");
const clients = await import("../app/(admin)/admin/clients/actions");
const bonos = await import("../app/(admin)/admin/bonos/actions");
const register = await import("../app/(auth)/register/actions");
const prova = await import("../app/(admin)/admin/prova/actions");
const serveis = await import("../app/(admin)/admin/serveis/actions");
const reservasAdmin = await import("../app/(admin)/admin/reservas/actions");
const reservasTrainer = await import("../app/(trainer)/trainer/reservas/actions");

/** Crida una acció; un `redirect` és com acaba bé una acció de formulari. */
async function run(fn: () => Promise<unknown>): Promise<string> {
  try {
    const r = await fn();
    if (r && typeof r === "object" && "error" in r && (r as { error?: string }).error)
      return `error: ${(r as { error: string }).error}`;
    return "ok";
  } catch (e) {
    if (e instanceof RedirectSignal) return "ok (redirect)";
    return `excepció: ${(e as Error).message}`;
  }
}
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
};

type Row = { accio: string; rol: string; escriu: boolean; resposta: string; esperat: boolean };
const rows: Row[] = [];
const record = (accio: string, rol: string, escriu: boolean, resposta: string, esperat: boolean) =>
  rows.push({ accio, rol, escriu, resposta, esperat });

try {
  // Preparació: subscripcions obertes i un paquet de grup només per subscripció.
  {
    const s = getStore();
    if (s.centerSettings) s.centerSettings.subscriptions_enabled = true;
    const grup = s.services.find((x) => x.service_type === "grupo_reducido" && x.active);
    if (!grup) throw new Error("La llavor no té cap paquet de grup actiu.");
    grup.subscription_only = true;
    s.promotions.push({
      id: "rc-promo", name: "Oferta de la prova", discount_type: "percentage", discount_value: 10,
      scope: "service", service_types: ["ep_individual"], service_ids: null, audience: "all", audience_tag_id: null,
      audience_service_type: null, starts_at: "2026-01-01", ends_at: "2027-12-31", active: true,
      created_at: new Date().toISOString(),
    } as never);
    // La Laia disponible tots els dies de 8 a 21: la reserva de prova ha de
    // passar per la disponibilitat i no aturar-s'hi.
    for (let wd = 0; wd < 7; wd++)
      s.availability_rules.push({
        id: `rc-r-${wd}`, trainer_id: "u-trainer-laia", weekday: wd, start_time: "08:00", end_time: "21:00",
        valid_from: "2026-01-01", valid_until: null, service_types: ["ep_individual"], created_at: "2026-01-01T00:00:00Z",
      } as never);
    const jordi = s.profiles.find((p) => p.id === "u-trainer-jordi");
    if (jordi) jordi.avatar_path = "rc/avatar-original.webp";
    saveStore(s);
  }
  const grupId = getStore().services.find((x) => x.service_type === "grupo_reducido" && x.subscription_only)!.id;
  const today = new Date().toISOString().slice(0, 10);

  for (const rol of ["client", "trainer", "admin"] as Role[]) {
    as(rol);
    const admin = rol === "admin";

    // 1. Alta d'un professional.
    const email = `rc-${rol}@exemple.cat`;
    const r1 = await run(() =>
      entrenadors.createTrainerAction({}, fd({ fullName: `Prova ${rol}`, email, specialty: "entrenador" })),
    );
    record("createTrainerAction", rol, getStore().profiles.some((p) => p.email === email && p.role === "trainer"), r1, admin);

    // 2. Ofertes: crear, editar, activar/desactivar i esborrar.
    const nom = `Descompte de la prova ${rol}`;
    const r2 = await run(() =>
      ofertes.createOfertaAction({}, fd({ name: nom, discountType: "percentage", discountValue: "100", scope: "service", serviceType: "ep_individual", startsAt: today, endsAt: "2027-12-31", audience: "all" })),
    );
    record("createOfertaAction", rol, getStore().promotions.some((p) => p.name === nom), r2, admin);

    const r3 = await run(() =>
      ofertes.updateOfertaAction("rc-promo", {}, fd({ name: `Editada per ${rol}`, discountType: "percentage", discountValue: "100", scope: "service", serviceType: "ep_individual", startsAt: "2026-01-01", endsAt: "2027-12-31", audience: "all" })),
    );
    const promo = () => getStore().promotions.find((p) => p.id === "rc-promo");
    record("updateOfertaAction", rol, promo()?.name === `Editada per ${rol}`, r3, admin);

    const abansActiva = promo()?.active;
    const r4 = await run(() => ofertes.toggleOfertaAction(fd({ id: "rc-promo", active: String(!abansActiva) })));
    record("toggleOfertaAction", rol, promo()?.active !== abansActiva, r4, admin);
    if (promo()?.active !== abansActiva) {
      const s = getStore();
      s.promotions.find((p) => p.id === "rc-promo")!.active = abansActiva!;
      saveStore(s);
    }

    {
      const s = getStore();
      s.promotions.push({ ...s.promotions.find((p) => p.id === "rc-promo")!, id: `rc-del-${rol}`, name: `Per esborrar ${rol}` } as never);
      saveStore(s);
    }
    const r4b = await run(() => ofertes.deleteOfertaAction(fd({ id: `rc-del-${rol}` })));
    record("deleteOfertaAction", rol, !getStore().promotions.some((p) => p.id === `rc-del-${rol}`), r4b, admin);

    // 3. Subscripció al centre: Ana és de la Laia; Marta, d'en Jordi.
    const subsAna = () => getStore().subscriptions.filter((x) => x.client_id === "c-ana").length;
    const nAna = subsAna();
    const r5 = await run(() => bonos.createGroupSubscriptionAction("c-ana", {}, fd({ serviceId: grupId })));
    record("createGroupSubscriptionAction (Ana, de la Laia)", rol, subsAna() > nAna, r5, rol !== "client");
    {
      const s = getStore();
      s.subscriptions = s.subscriptions.filter((x) => x.client_id !== "c-ana");
      s.bonos = s.bonos.filter((b) => !(b.client_id === "c-ana" && b.subscription_id));
      saveStore(s);
    }
    const subsMarta = () => getStore().subscriptions.filter((x) => x.client_id === "c-marta").length;
    const nMarta = subsMarta();
    const r6 = await run(() => bonos.createGroupSubscriptionAction("c-marta", {}, fd({ serviceId: grupId })));
    record("createGroupSubscriptionAction (Marta, d'en Jordi)", rol, subsMarta() > nMarta, r6, admin);
    {
      const s = getStore();
      s.subscriptions = s.subscriptions.filter((x) => x.client_id !== "c-marta");
      s.bonos = s.bonos.filter((b) => !(b.client_id === "c-marta" && b.subscription_id));
      saveStore(s);
    }

    // 4. Alta d'un client.
    const cEmail = `rc-client-${rol}@exemple.cat`;
    const r7 = await run(() =>
      clients.createClientAction({}, fd({ fullName: `Client prova ${rol}`, email: cEmail, phone: "600000000", assignedTrainerId: "u-trainer-laia" })),
    );
    record("createClientAction", rol, getStore().profiles.some((p) => p.email === cEmail), r7, admin);

    // 5. Especialitat i foto d'un professional (en Jordi).
    {
      const s = getStore();
      const j = s.profiles.find((p) => p.id === "u-trainer-jordi")!;
      j.specialty = "fisioterapeuta";
      j.avatar_path = "rc/avatar-original.webp";
      saveStore(s);
    }
    const r8 = await run(() =>
      entrenadors.updateTrainerSpecialtyAction("u-trainer-jordi", {}, fd({ specialty: "entrenador", removeAvatar: "true" })),
    );
    const j = getStore().profiles.find((p) => p.id === "u-trainer-jordi")!;
    record("updateTrainerSpecialtyAction", rol, j.specialty === "entrenador" || j.avatar_path !== "rc/avatar-original.webp", r8, admin);

    // 7. Proves (corregides a 99604cf): acceptar, rebutjar i tancar, només l'admin.
    {
      const s = getStore();
      const t = (id: string, status: string) => ({
        id, full_name: "Prova de rols", email: `${id}@exemple.cat`, phone: "600000000",
        trainer_id: "u-trainer-laia", scheduled_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        service_type: "ep_individual", status, expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        converted_client_id: null, consent_privacy_at: new Date().toISOString(), ip: null,
        created_at: new Date().toISOString(),
      });
      s.trial_bookings.push(t(`rc-acc-${rol}`, "pending") as never, t(`rc-rej-${rol}`, "pending") as never, t(`rc-fin-${rol}`, "confirmed") as never);
      saveStore(s);
    }
    const st = (id: string) => getStore().trial_bookings.find((x) => x.id === id)?.status;
    const ra = await run(() => prova.acceptTrialAdminAction(fd({ id: `rc-acc-${rol}` })));
    record("acceptTrialAdminAction", rol, st(`rc-acc-${rol}`) !== "pending", ra, admin);
    const rr = await run(() => prova.rejectTrialAdminAction(fd({ id: `rc-rej-${rol}` })));
    record("rejectTrialAdminAction", rol, st(`rc-rej-${rol}`) !== "pending", rr, admin);
    const rf = await run(() => prova.setTrialStatusAdminAction(fd({ id: `rc-fin-${rol}`, status: "completed" })));
    record("setTrialStatusAdminAction", rol, st(`rc-fin-${rol}`) !== "confirmed", rf, admin);

    // 8. Defensa en profunditat (escriuen amb la sessió; la RLS ja les frenava):
    // ara també les para l'acció. Mostra: un servei i una reserva per cada porta.
    const svcName = `Servei de la prova ${rol}`;
    const r11 = await run(() =>
      serveis.createServiceAction({}, fd({ serviceType: "ep_individual", name: svcName, price: "10", defaultSessions: "1" })),
    );
    record("createServiceAction", rol, getStore().services.some((x) => x.name === svcName), r11, admin);
    // Les reserves noves de l'Ana, per id: el formulari interpreta l'hora a la
    // seva manera i no es pot buscar per l'instant exacte.
    const when = new Date(Date.now() + 9 * 86_400_000);
    when.setUTCHours(9, 0, 0, 0);
    const anaIds = () => new Set(getStore().reservations.filter((r) => r.client_id === "c-ana").map((r) => r.id));
    const dropNew = (before: Set<string>) => {
      const s = getStore();
      const n0 = s.reservations.length;
      s.reservations = s.reservations.filter((r) => r.client_id !== "c-ana" || before.has(r.id));
      saveStore(s);
      return s.reservations.length < n0;
    };
    const ba = anaIds();
    const r12 = await run(() =>
      reservasAdmin.createReservationAction({}, fd({ clientId: "c-ana", bonoId: "b-1", trainerId: "u-trainer-laia", serviceType: "ep_individual", scheduledAt: when.toISOString() })),
    );
    record("createReservationAction (admin)", rol, dropNew(ba), r12, admin);
    const bt = anaIds();
    const r13 = await run(() =>
      reservasTrainer.createTrainerReservationAction({}, fd({ clientId: "c-ana", bonoId: "b-1", trainerId: "u-trainer-laia", serviceType: "ep_individual", scheduledAt: when.toISOString() })),
    );
    record("createTrainerReservationAction", rol, dropNew(bt), r13, rol === "trainer");

    // 6. Consentiment de registre: el d'un ALTRE usuari, i el propi.
    const consents = (u: string) => getStore().consents.filter((c) => c.user_id === u).length;
    const other = "u-client-pau";
    const nOther = consents(other);
    const r9 = await run(() => register.recordRegistrationConsentAction(other));
    record("recordRegistrationConsentAction (d'un altre)", rol, consents(other) > nOther, r9, false);
    const own = getStore().profiles.find((p) => p.role === rol)!.id;
    const nOwn = consents(own);
    const r10 = await run(() => register.recordRegistrationConsentAction(own));
    record("recordRegistrationConsentAction (el propi)", rol, consents(own) > nOwn, r10, true);
  }
} catch (e) {
  console.error(e);
} finally {
  restaura();
}

let bad = 0;
console.log("\n" + "acció".padEnd(52) + "rol      escriu  esperat  resposta");
for (const r of rows) {
  const okRow = r.escriu === r.esperat;
  if (!okRow) bad++;
  console.log(
    `${okRow ? "✓" : "✗"} ${r.accio.padEnd(50)} ${r.rol.padEnd(8)} ${(r.escriu ? "SÍ" : "no").padEnd(7)} ${(r.esperat ? "sí" : "no").padEnd(8)} ${r.resposta.slice(0, 60)}`,
  );
}
console.log(bad ? `\n${bad} files no fan el que han de fer.\n` : "\nTot correcte.\n");
process.exit(bad ? 1 : 0);
