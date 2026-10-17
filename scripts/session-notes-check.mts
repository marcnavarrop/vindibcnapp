/**
 * Les notes de sessió (0079, 0125, 0126): qui les llegeix i on surten juntes.
 *
 *   npm run session-notes:check
 *
 *   1. La regla pura (`lib/session-note-access.ts`), la mateixa que
 *      `can_read_session_note` de la base, cas per cas, amb demo amb demo.
 *   2. En simulació, `listClientSessionNotes` (la llista de la fitxa) amb cada
 *      rol: l'entrenadora assignada, la mateixa amb un client que no és seu,
 *      el fisio, l'admin i el client.
 *   3. L'exportació RGPD porta les notes de sessió.
 *
 * La base ho torna a mirar amb la RLS: supabase/tests/0125_session_notes_read_rls.sql.
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
const setRole = (r: string) => ((globalThis as { __mockRole?: string }).__mockRole = r);

const { canReadSessionNote } = await import("../lib/session-note-access");
const { REAL_WORLD } = await import("../lib/demo-accounts");
const { getStore, saveStore } = await import("../lib/mock/store");
const { seedProfiles } = await import("../lib/mock/seed");
const { listClientSessionNotes } = await import("../lib/data/session-notes");
const { exportClientData } = await import("../lib/data/gdpr-export");

let bad = 0;
const check = (nom: string, ok: boolean, detall = "") => {
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${nom}${detall ? ` — ${detall}` : ""}`);
};

try {
  console.log("\n1. La regla pura\n");
  const admin = { id: "adm", role: "admin" as const, specialty: null };
  const ent = { id: "ent", role: "trainer" as const, specialty: "entrenador" as const };
  const altre = { id: "altre", role: "trainer" as const, specialty: "entrenador" as const };
  const fisio = { id: "fis", role: "trainer" as const, specialty: "fisioterapeuta" as const };
  const cli = { id: "pcli", role: "client" as const, specialty: null };
  const sess = (serviceType: "fisioterapia" | "grupo_reducido", trainerId: string) => ({
    clientId: "c1", clientProfileId: "pcli", trainerId, serviceType, assignedTrainerId: "ent",
  });
  const R = (v: typeof admin | typeof ent | typeof fisio | typeof cli, s: ReturnType<typeof sess>, w = REAL_WORLD) => canReadSessionNote(v, s, w);
  check("admin: fisio i grup", R(admin, sess("fisioterapia", "fis")) && R(admin, sess("grupo_reducido", "altre")));
  check("client: les seves (també fisio)", R(cli, sess("fisioterapia", "fis")) && R(cli, sess("grupo_reducido", "altre")));
  check("client: les d'un altre client, no", !R({ ...cli, id: "un-altre" }, sess("grupo_reducido", "altre")));
  check("entrenador ASSIGNAT: fisio (només llegir) i grup d'un altre", R(ent, sess("fisioterapia", "fis")) && R(ent, sess("grupo_reducido", "altre")));
  check("entrenador NO assignat: res si no la va fer", !R(altre, sess("fisioterapia", "fis")) && !R(altre, sess("grupo_reducido", "fis")));
  check("entrenador NO assignat: la de la seva sessió, sí", R(altre, sess("grupo_reducido", "altre")));
  check("qualsevol fisio: fisio sí; grup d'un altre, no", R(fisio, sess("fisioterapia", "un-fisio")) && !R(fisio, sess("grupo_reducido", "altre")));
  const demo = { profileIds: new Set(["fis"]), clientIds: new Set<string>() };
  check("demo amb demo: un fisio demo no llegeix un client real", !R(fisio, sess("fisioterapia", "fis"), demo));

  console.log("\n2. La llista de la fitxa, en simulació\n");
  fs.rmSync(STORE, { force: true });
  {
    const s = getStore();
    const base = s.reservations.find((r) => r.id === "r-3")!;
    const res = (id: string, client_id: string, trainer_id: string, service_type: string, at: string) =>
      ({ ...base, id, client_id, trainer_id, service_type, status: "completed", scheduled_at: at, ends_at: at, bono_id: null }) as never;
    s.reservations.push(
      res("sn-1", "c-ana", "u-trainer-jordi", "fisioterapia", "2026-03-02T09:00:00.000Z"),
      res("sn-2", "c-ana", "u-trainer-jordi", "grupo_reducido", "2026-03-03T09:00:00.000Z"),
      res("sn-3", "c-ana", "u-trainer-laia", "ep_individual", "2026-03-04T09:00:00.000Z"),
      res("sn-4", "c-marta", "u-trainer-laia", "grupo_reducido", "2026-03-05T09:00:00.000Z"),
    );
    const note = (reservation_id: string, author_id: string, body: string) =>
      ({ reservation_id, author_id, body, created_at: "2026-03-06T09:00:00.000Z", updated_at: "2026-03-06T09:00:00.000Z" });
    s.session_notes.push(
      note("sn-1", "u-trainer-jordi", "Fisio: lumbar millor"),
      note("sn-2", "u-trainer-jordi", "Grup: bé"),
      note("sn-3", "u-trainer-laia", "Individual: sentadilla 60 kg"),
      note("sn-4", "u-trainer-laia", "Grup de la Marta"),
    );
    saveStore(s);
  }
  const ids = async (clientId: string) => (await listClientSessionNotes(clientId)).notes.map((n) => n.reservationId).join(",");

  setRole("trainer"); // la Laia (entrenadora), assignada a l'Ana
  check("Laia (assignada a l'Ana): les tres, la més recent primer", (await ids("c-ana")) === "sn-3,sn-2,sn-1", await ids("c-ana"));
  check("Laia amb la Marta (no és seva): només la de la sessió que va fer", (await ids("c-marta")) === "sn-4", await ids("c-marta"));
  const n3 = (await listClientSessionNotes("c-ana")).notes.find((n) => n.reservationId === "sn-1");
  check("porta data, servei i professional", n3?.serviceType === "fisioterapia" && n3.trainerName === "Jordi Soler" && n3.scheduledAt.startsWith("2026-03-02"));

  const laia = seedProfiles.find((p) => p.id === "u-trainer-laia")!;
  const abansEsp = laia.specialty;
  laia.specialty = "fisioterapeuta"; // la Laia feta fisio, només aquí
  check("un fisio amb la Marta: la de grup que va fer ell, sí; cap més", (await ids("c-marta")) === "sn-4");
  laia.specialty = abansEsp;
  {
    const s = getStore();
    s.clients.find((c) => c.id === "c-ana")!.assigned_trainer_id = null;
    saveStore(s);
  }
  check("Laia, si deixa de ser l'assignada de l'Ana: només la seva", (await ids("c-ana")) === "sn-3", await ids("c-ana"));
  {
    const s = getStore();
    s.clients.find((c) => c.id === "c-ana")!.assigned_trainer_id = "u-trainer-laia";
    saveStore(s);
  }

  setRole("admin");
  check("admin: totes les de l'Ana", (await ids("c-ana")) === "sn-3,sn-2,sn-1");
  setRole("client"); // l'Ana
  check("l'Ana: les seves", (await ids("c-ana")) === "sn-3,sn-2,sn-1");
  check("l'Ana amb la Marta: cap", (await ids("c-marta")) === "");

  console.log("\n3. L'exportació RGPD\n");
  const exp = await exportClientData("c-ana");
  const sn = (exp?.data.session_notes ?? []) as { reservation_id: string; author_name: string | null; service_type: string }[];
  check("porta les notes de sessió de l'Ana (també la de fisio)", sn.length === 3 && sn.some((n) => n.service_type === "fisioterapia"));
  check("amb qui la va escriure", sn.find((n) => n.reservation_id === "sn-1")?.author_name === "Jordi Soler");
} catch (e) {
  bad++;
  console.error(e);
} finally {
  restaura();
}

console.log(bad ? `\n${bad} casos no fan el que han de fer.\n` : "\nTot correcte.\n");
process.exit(bad ? 1 : 0);
