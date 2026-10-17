/**
 * El correu de la comunitat arriba a TOTHOM i cap fallada queda en silenci,
 * en simulació i amb un transport fals (no surt cap correu):
 *
 *   npm run community:check
 *
 *   · 1.200 apuntats → 1.200 files 'queued' i 12 lots de 100 (cap límit de 500).
 *   · Cadascú en el seu idioma dins del mateix lot; l'admin no el rep.
 *   · Un lot que falla queda 'failed' amb el motiu i els altres continuen.
 *   · Un 429 de «massa peticions» s'espera i es torna a provar, amb la
 *     mateixa clau d'idempotència.
 *   · Si s'esgota el límit diari, aquell lot i tots els que vénen queden
 *     'failed' amb «Límit diari…» i no es fa cap crida més.
 *   · El recompte de l'admin («Enviat a N de M») surt del log.
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
const { queueCommunity, deliverCommunity, getCommunityDelivery } = await import("../lib/notifications/community");
const { classifyResendError } = await import("../lib/email");
type BatchEmail = import("../lib/email").BatchEmail;
type BatchResult = import("../lib/email").BatchResult;

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

const LANGS = ["ca", "es", "en"] as const;
const CTA = { ca: "Veure-ho a la comunitat", es: "Verlo en la comunidad", en: "See it in the community" };

try {
  console.log("\nclassifyResendError");
  {
    const q = classifyResendError(429, JSON.stringify({ name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." }), null);
    check(q.kind === "quota" && q.error.startsWith("Límit diari"), `429 daily_quota_exceeded → quota («${q.error.slice(0, 40)}…»)`);
    const m = classifyResendError(429, JSON.stringify({ name: "monthly_quota_exceeded" }), null);
    check(m.kind === "quota" && m.error.startsWith("Límit mensual"), "429 monthly_quota_exceeded → quota mensual");
    const r = classifyResendError(429, JSON.stringify({ name: "rate_limit_exceeded" }), "2");
    check(r.kind === "rate" && r.retryAfterMs === 2000, "429 rate_limit_exceeded → es reintenta al cap de retry-after");
    const o = classifyResendError(422, JSON.stringify({ name: "validation_error" }), null);
    check(o.kind === "other" && o.error.includes("422"), "422 → fallit, amb el codi al motiu");
  }

  // 1.200 apuntats (clients en tres idiomes i algun professional) + un admin apuntat.
  const s = getStore();
  for (const p of s.notification_preferences) p.community_email = false;
  const N = 1200;
  for (let i = 0; i < N; i++) {
    const id = `cm-${i}`;
    const role = i % 50 === 0 ? "trainer" : "client";
    s.profiles.push({
      ...s.profiles.find((p) => p.role === role)!,
      id, full_name: `Persona ${i}`, email: `p${i}@example.test`, role, preferred_language: LANGS[i % 3],
    } as never);
    s.notification_preferences.push({ ...s.notification_preferences[0], profile_id: id, community_email: true } as never);
  }
  const admin = s.profiles.find((p) => p.role === "admin")!;
  const adminPref = s.notification_preferences.find((p) => p.profile_id === admin.id);
  if (adminPref) adminPref.community_email = true;
  const annId = crypto.randomUUID();
  s.announcements.push({ id: annId, title: "Horari d'estiu", body: "Tancat el 15 d'agost.", author_id: admin.id, created_at: new Date().toISOString() } as never);
  saveStore(s);

  const post = { announcementId: annId, title: "Horari d'estiu", body: "Tancat el 15 d'agost." };

  console.log("\nApuntar");
  const queued = await queueCommunity(post);
  check(queued.length === N, `${queued.length} destinataris apuntats (sense el tall de 500)`);
  check(!queued.some((q) => q.recipient.profileId === admin.id), "l'admin no hi és");
  const d0 = (await getCommunityDelivery([annId])).get(annId)!;
  check(d0.total === N && d0.queued === N && d0.sent === 0, `abans d'enviar: ${d0.queued} 'queued' de ${d0.total}`);

  console.log("\nEnviar (transport fals)");
  const calls: { n: number; key?: string; emails: BatchEmail[] }[] = [];
  let waited = 0;
  let rateOnce = true;
  const fake = async (emails: BatchEmail[], key?: string): Promise<BatchResult> => {
    calls.push({ n: emails.length, key, emails });
    const lot = Number(key?.split("-").pop());
    if (lot === 2) return { ok: false, kind: "other", error: "Resend 500: internal_server_error" };
    if (lot === 4 && rateOnce) { rateOnce = false; return { ok: false, kind: "rate", error: "Massa peticions a Resend", retryAfterMs: 1000 }; }
    if (lot === 8) return { ok: false, ...classifyResendError(429, JSON.stringify({ name: "daily_quota_exceeded" }), null) };
    return { ok: true, ids: emails.map((_, j) => `fake-${lot}-${j}`) };
  };
  const res = await deliverCommunity(post, queued, fake, async (ms) => { waited += ms; });

  const keys = calls.map((c) => c.key);
  check(calls.every((c) => c.n <= 100), `cap lot passa de 100 (${calls.map((c) => c.n).join(", ")})`);
  check(keys.filter((k) => k?.endsWith("-4")).length === 2 && waited === 1000, "el lot 5 (429 de velocitat) s'ha reintentat un cop, amb la mateixa clau, després d'esperar 1 s");
  check(!keys.some((k) => Number(k?.split("-").pop()) > 8), "després del límit diari (lot 9) no s'ha fet cap crida més");
  check(res.sent === 700 && res.failed === 500, `resultat: ${res.sent} enviats, ${res.failed} fallits (lot 3 + lots 9–12)`);

  const first = calls[0].emails;
  const byLang = LANGS.map((l, k) => first[k]);
  check(
    LANGS.every((l, k) => (byLang[k].html.includes(CTA[l]) && (l === "ca" || !byLang[k].html.includes(CTA.ca)))),
    "dins del mateix lot, cada client el rep en el seu idioma (ca, es, en)",
  );
  const trainerMail = first.find((e) => e.to === "p0@example.test")!;
  check(trainerMail.html.includes(CTA.ca), "el professional el rep en català");

  console.log("\nLa baixa a cada correu (0124, art. 21.2 LSSI)");
  {
    const { verifyUnsubscribe } = await import("../lib/unsubscribe");
    const m = first[0];
    const href = /href="([^"]*\/baixa\/comunitat\?[^"]*)"/.exec(m.html)?.[1]?.replace(/&amp;/g, "&");
    check(!!href && m.html.includes("data-unsubscribe"), "el correu porta l'enllaç visible per deixar de rebre'ls");
    const u = new URL(href ?? "http://x/");
    const pid = u.searchParams.get("p");
    check(!!pid && verifyUnsubscribe(pid, u.searchParams.get("t")), "l'enllaç va signat per a qui el rep");
    check(!verifyUnsubscribe(pid, "x".repeat(32)) && !verifyUnsubscribe("altre-perfil", u.searchParams.get("t")), "una signatura falsa o d'un altre perfil no val");
    check(/\/baixa\/comunitat\?/.test(m.text ?? ""), "també al text pla");
    check(!!m.headers?.["List-Unsubscribe"]?.includes("/api/unsubscribe/community?") && m.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click", "capçaleres List-Unsubscribe d'un sol clic");
    const { unsubscribeCommunity } = await import("../lib/data/community-notice");
    const r1 = await unsubscribeCommunity(pid!);
    const row = getStore().notification_preferences.find((x) => x.profile_id === pid);
    check(r1?.alreadyOff === false && row?.community_email === false, "en donar-se de baixa, community_email queda a false");
    const r2 = await unsubscribeCommunity(pid!);
    check(r2?.alreadyOff === true, "un segon cop: ja estava de baixa");
  }

  console.log("\nUn client nou (0124)");
  {
    const { createClientRecord } = await import("../lib/data/clients");
    const { getCommunityNotice, confirmCommunityNotice } = await import("../lib/data/community-notice");
    const cid = await createClientRecord({ fullName: "Client Nou 0124", email: "nou0124@example.test", phone: null, assignedTrainerId: null, generalNotes: null });
    const prof = getStore().clients.find((c) => c.id === cid)!.profile_id;
    let n = await getCommunityNotice(prof);
    check(n.pending && n.communityEmail, "neix amb les novetats per correu activades i l'avís pendent");
    await confirmCommunityNotice(prof, false);
    n = await getCommunityNotice(prof);
    check(!n.pending && !n.communityEmail, "si al primer accés desmarca la casella: desactivades i ja avisat");
    const ana = await getCommunityNotice("u-client-ana");
    check(!ana.pending, "un client d'abans no té res pendent");
  }

  console.log("\nLog");
  const log = getStore().notification_log.filter((l) => l.related_id === annId);
  check(log.length === N, `${log.length} files al log, una per persona (cap de duplicada)`);
  check(!log.some((l) => l.status === "queued"), "no en queda cap 'queued'");
  const lot3 = log.filter((l) => l.error?.includes("internal_server_error"));
  check(lot3.length === 100, `el lot 3: ${lot3.length} 'failed' amb «Resend 500…»`);
  const quota = log.filter((l) => l.error?.startsWith("Límit diari"));
  check(quota.length === 400, `els lots 9–12: ${quota.length} 'failed' amb «Límit diari de correus de Resend esgotat»`);
  check(log.filter((l) => l.status === "sent").every((l) => l.provider_id?.startsWith("fake-")), "els enviats porten l'id del proveïdor");

  const d1 = (await getCommunityDelivery([annId])).get(annId)!;
  check(d1.total === N && d1.sent === 700 && d1.failed === 500 && d1.queued === 0, `a la pantalla: «Correu: enviat a ${d1.sent} de ${d1.total} · ${d1.failed} fallits»`);
  check(!!d1.firstError, `amb un motiu: «${d1.firstError?.slice(0, 50)}…»`);

  console.log("\nSense ningú apuntat");
  {
    const st = getStore();
    for (const p of st.notification_preferences) p.community_email = false;
    saveStore(st);
    const none = await queueCommunity({ ...post, announcementId: crypto.randomUUID() });
    check(none.length === 0, "cap destinatari, cap fila i res a enviar");
  }
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
