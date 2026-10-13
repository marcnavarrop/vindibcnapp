/**
 * L'historial clínic (tiquet d'en Sergi «Primera visita / Seguiment»; 0110):
 *
 *   npm run clinical:check
 *
 *   1. La regla pura (`lib/clinical-access.ts`), cas per cas, amb «demo amb demo».
 *   2. El camí sencer en simulació, amb les accions de servidor:
 *      - la Laia, entrenadora: llegeix la seva Ana, no hi escriu; la Marta
 *        (d'en Jordi) no la veu;
 *      - la Laia feta fisio: escriu a la Marta (no és seva), edita el SEU
 *        seguiment i no el d'un altre, no esborra; obrir deixa «vist» i una
 *        fila al registre d'accessos;
 *      - l'admin: edita el seguiment del fisio i l'esborra; obrir no registra;
 *      - l'avís de novetat a l'entrenadora assignada, i com s'apaga en obrir;
 *      - l'exportació de dades porta l'historial i l'esborrat RGPD se l'endú.
 *
 * La base ho torna a mirar amb la RLS: això ho prova el bloc del SQL Editor de
 * la 0110. Treballa sobre el fitxer de la simulació i el deixa tal com era.
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

const access = await import("../lib/clinical-access");
const { DEMO_CLIENT_ID, DEMO_TRAINER_IDS } = await import("../lib/demo-accounts");
const { getStore } = await import("../lib/mock/store");
const { seedProfiles } = await import("../lib/mock/seed");
const actions = await import("../app/actions/clinical-history-actions");
const { getClinicalHistory, clientsWithClinicalNovelty } = await import("../lib/data/clinical-history");
const { exportClientData } = await import("../lib/data/gdpr-export");
const { deleteClient } = await import("../lib/data/gdpr-delete");

let bad = 0;
const check = (nom: string, ok: boolean, detall = "") => {
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${nom}${detall ? ` — ${detall}` : ""}`);
};
const espera = () => new Promise((r) => setTimeout(r, 15));

// ─── 1. La regla pura ───────────────────────────────────────────────────────
console.log("\n1. La regla pura\n");
const admin = { id: "adm", role: "admin" as const, specialty: null };
const fisio = { id: "fis", role: "trainer" as const, specialty: "fisioterapeuta" as const };
const entr = { id: "ent", role: "trainer" as const, specialty: "entrenador" as const };
const client = { id: "cli", role: "client" as const, specialty: null };
const fisioDemo = { id: DEMO_TRAINER_IDS[1], role: "trainer" as const, specialty: "fisioterapeuta" as const };
const seu = { id: "c1", assignedTrainerId: "ent" };
const dAltre = { id: "c2", assignedTrainerId: "altre" };
const demo = { id: DEMO_CLIENT_ID, assignedTrainerId: DEMO_TRAINER_IDS[0] };

const R = access.canReadClinical, W = access.canWriteClinical, E = access.canEditFollowup;
check("admin llegeix, escriu i esborra", R(admin, dAltre) && W(admin, dAltre) && access.canDeleteClinical(admin));
check("admin edita un seguiment d'un altre", E(admin, dAltre, "fis"));
check("fisio llegeix i escriu un client que no és seu", R(fisio, dAltre) && W(fisio, dAltre));
check("fisio edita el seu seguiment", E(fisio, dAltre, "fis"));
check("fisio NO edita el d'un altre", !E(fisio, dAltre, "altre"));
check("fisio NO esborra", !access.canDeleteClinical(fisio));
check("entrenador assignat llegeix i no escriu", R(entr, seu) && !W(entr, seu) && !E(entr, seu, "ent"));
check("entrenador no assignat no veu res", !R(entr, dAltre));
check("el client no veu res", !R(client, seu) && !W(client, seu));
check("fisio real amb el Client Demo: res", !R(fisio, demo) && !W(fisio, demo));
check("fisio demo amb el Client Demo: sí", R(fisioDemo, demo) && W(fisioDemo, demo));
check("fisio demo amb un client real: res", !R(fisioDemo, dAltre) && !W(fisioDemo, dAltre));
check("admin amb el Client Demo: sí", R(admin, demo) && W(admin, demo));

// ─── 2. En simulació ────────────────────────────────────────────────────────
const laia = seedProfiles.find((p) => p.id === "u-trainer-laia")!;
const abansEsp = laia.specialty;
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const s = () => getStore();
const followupsDe = (c: string) => s().clinical_followups.filter((f) => f.client_id === c);
const logs = () => s().data_access_log.filter((l) => l.action === "clinical_view");
const viewer = (id: string) => {
  const p = seedProfiles.find((x) => x.id === id)!;
  return { id: p.id, email: p.email ?? "", fullName: p.full_name ?? "", role: p.role, specialty: p.specialty ?? null };
};

try {
  console.log("\n2a. Laia, entrenadora\n");
  setRole("trainer");
  let r = await actions.saveFirstVisitAction("c-ana", {}, fd({ body: "Intent de l'entrenadora" }));
  check("no escriu la primera visita de la seva Ana", !!r.error && !s().clinical_first_visits.some((f) => f.body.startsWith("Intent")), r.error);
  r = await actions.addFollowupAction("c-ana", {}, fd({ body: "Intent" }));
  check("no afegeix seguiment", !!r.error && followupsDe("c-ana").length === 0, r.error);
  const ana = { id: "c-ana", assignedTrainerId: "u-trainer-laia" };
  const marta = { id: "c-marta", assignedTrainerId: "u-trainer-jordi" };
  const hAna = await getClinicalHistory(ana, viewer("u-trainer-laia"));
  check("llegeix la primera visita de l'Ana", hAna.firstVisit?.body === "Lesió prèvia de genoll. Treballar mobilitat.");
  r = await actions.saveFirstVisitAction("c-marta", {}, fd({ body: "Intent" }));
  check("no escriu a la Marta (no és seva)", !!r.error, r.error);
  const l0 = logs().length;
  await actions.clinicalHistoryOpenedAction("c-marta");
  check("obrir la Marta: ni vist ni registre", logs().length === l0 && !s().clinical_seen.some((x) => x.client_id === "c-marta"));

  console.log("\n2b. Laia feta fisio\n");
  laia.specialty = "fisioterapeuta";
  r = await actions.saveFirstVisitAction("c-marta", {}, fd({ body: "  Dolor lumbar. Exploració: …  " }));
  const fv = s().clinical_first_visits.find((f) => f.client_id === "c-marta");
  check("escriu la primera visita de la Marta (no és seva)", !r.error && fv?.body === "Dolor lumbar. Exploració: …" && fv?.created_by === "u-trainer-laia", r.error);
  r = await actions.saveFirstVisitAction("c-marta", {}, fd({ body: "   " }));
  check("buida, no", !!r.error, r.error);
  r = await actions.saveFirstVisitAction("c-marta", {}, fd({ body: "x".repeat(20001) }));
  check("més de 20.000 caràcters, no", !!r.error, r.error);
  r = await actions.addFollowupAction("c-marta", {}, fd({ body: "Sessió 1: millora" }));
  const meu = followupsDe("c-marta")[0];
  check("afegeix un seguiment, amb ella d'autora", !r.error && meu?.author_id === "u-trainer-laia", r.error);
  await espera();
  r = await actions.editFollowupAction({}, fd({ id: meu.id, body: "Sessió 1: millora clara" }));
  check("edita el seu seguiment", !r.error && followupsDe("c-marta")[0].body === "Sessió 1: millora clara", r.error);
  // Un seguiment d'algú altre (en Jordi, el fisio real de la Marta).
  const st = getStore();
  st.clinical_followups.push({
    id: "cc-jordi-1", client_id: "c-marta", author_id: "u-trainer-jordi", body: "Seguiment d'en Jordi",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } as never);
  (await import("../lib/mock/store")).saveStore(st);
  r = await actions.editFollowupAction({}, fd({ id: "cc-jordi-1", body: "Canviat" }));
  check("NO edita el d'en Jordi", !!r.error && followupsDe("c-marta").find((f) => f.id === "cc-jordi-1")?.body === "Seguiment d'en Jordi", r.error);
  r = await actions.deleteFollowupAction({}, fd({ id: meu.id }));
  check("NO esborra (ni el seu)", !!r.error && followupsDe("c-marta").some((f) => f.id === meu.id), r.error);
  const l1 = logs().length;
  await actions.clinicalHistoryOpenedAction("c-marta");
  const nouLog = logs().slice(l1);
  check(
    "obrir: vist i una fila al registre d'accessos",
    s().clinical_seen.some((x) => x.client_id === "c-marta" && x.viewer_id === "u-trainer-laia") &&
      nouLog.length === 1 && nouLog[0].actor_id === "u-trainer-laia" && nouLog[0].subject_profile_id === "u-client-marta",
    `${nouLog.length} fila`,
  );

  console.log("\n2c. Avís de novetat a l'entrenador assignat (en Jordi, de la Marta)\n");
  check("en Jordi té novetat a la Marta", (await clientsWithClinicalNovelty("u-trainer-jordi")).includes("c-marta"));
  check("la Laia no té avís de la Marta (no és seva)", !(await clientsWithClinicalNovelty("u-trainer-laia")).includes("c-marta"));
  {
    const st2 = getStore();
    st2.clinical_seen.push({ viewer_id: "u-trainer-jordi", client_id: "c-marta", seen_at: new Date(Date.now() + 1000).toISOString() } as never);
    (await import("../lib/mock/store")).saveStore(st2);
  }
  check("un cop vist, s'apaga", !(await clientsWithClinicalNovelty("u-trainer-jordi")).includes("c-marta"));
  laia.specialty = abansEsp;

  console.log("\n2d. Admin\n");
  setRole("admin");
  await espera();
  r = await actions.editFollowupAction({}, fd({ id: meu.id, body: "Corregit per l'admin" }));
  check("edita el seguiment del fisio", !r.error && followupsDe("c-marta").find((f) => f.id === meu.id)?.body === "Corregit per l'admin", r.error);
  r = await actions.deleteFollowupAction({}, fd({ id: "cc-jordi-1" }));
  check("esborra un seguiment", !r.error && !followupsDe("c-marta").some((f) => f.id === "cc-jordi-1"), r.error);
  const l2 = logs().length;
  await actions.clinicalHistoryOpenedAction("c-marta");
  check("obrir com a admin no registra", logs().length === l2);

  console.log("\n2e. Dades del client (RGPD)\n");
  const exp = await exportClientData("c-marta");
  const ch = exp?.data.clinical_history as { first_visit: { body: string } | null; followups: unknown[] } | undefined;
  check("l'exportació porta la primera visita i els seguiments", ch?.first_visit?.body === "Dolor lumbar. Exploració: …" && ch?.followups.length === 1);
  await deleteClient("c-marta");
  check(
    "l'esborrat se l'endú tot",
    !s().clinical_first_visits.some((f) => f.client_id === "c-marta") &&
      followupsDe("c-marta").length === 0 &&
      !s().clinical_seen.some((x) => x.client_id === "c-marta"),
  );
} catch (e) {
  bad++;
  console.error(e);
} finally {
  laia.specialty = abansEsp;
  restaura();
}

console.log(bad ? `\n${bad} casos no fan el que han de fer.\n` : "\nTot correcte.\n");
process.exit(bad ? 1 : 0);
