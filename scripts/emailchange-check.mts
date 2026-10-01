/**
 * El canvi de correu d'un PROFESSIONAL que inicia l'admin, per la branca REAL
 * (la de Supabase) contra un Supabase de memòria i amb Resend fals: no toca
 * cap base ni envia res.
 *
 *   npm run emailchange:check
 *
 *   · Només l'admin: un professional o un client reben «No autoritzat» (a
 *     l'acció i a la funció de dades), i no es crea cap petició.
 *   · Només per a professionals: el correu d'un client o d'un admin no.
 *   · Correu invàlid, el mateix, o ja d'un altre compte → error, res enviat.
 *   · Bo: una petició amb el secret NOMÉS en hash; l'enllaç va NOMÉS al
 *     correu nou; el vell rep un avís sense cap enllaç; els textos diuen que
 *     ho ha demanat l'administració; tot al notification_log.
 *   · Una segona petició abans de 5 minuts → «espera»; passat el termini,
 *     anul·la la primera (només val l'últim enllaç).
 *   · El correu NO canvia fins que es confirma (no es toca auth ni profiles).
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
process.env.ALLOW_REAL_EMAILS = "true";
process.env.RESEND_API_KEY = "re_fake";
process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
delete process.env.NEXT_PUBLIC_USE_MOCK;

type Row = Record<string, unknown>;
const fake = { tables: {} as Record<string, Row[]>, hooks: {} };
(globalThis as { __fakeDb?: unknown }).__fakeDb = fake;
const g = globalThis as { __fakeUser?: { id: string; email: string } | null };

// Resend fals: es queden els correus que s'haurien enviat.
const sent: { to: string; subject: string; html: string; text: string }[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  if (String(url).startsWith("https://api.resend.com/emails")) {
    const b = JSON.parse(init?.body ?? "{}");
    sent.push({ to: b.to, subject: b.subject, html: b.html, text: b.text });
    return new Response(JSON.stringify({ id: `re_${sent.length}` }), { status: 200 });
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;

const { USE_MOCK } = await import("../lib/config");
const { requestEmailChangeByAdmin } = await import("../lib/data/email-change");
const { requestTrainerEmailChangeAction } = await import("../app/(admin)/admin/entrenadors/email-actions");

let fallides = 0;
const check = (c: boolean, m: string) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) fallides++; };

const ADMIN = { id: "u-admin", email: "admin@centre.test", role: "admin", full_name: "Marc" };
const LAIA = { id: "u-laia", email: "laia@vindibcn.com", role: "trainer", full_name: "Laia Millans" };
const CLIENT = { id: "u-client", email: "ana@exemple.cat", role: "client", full_name: "Ana" };
const reset = () => {
  fake.tables = { profiles: [{ ...ADMIN }, { ...LAIA }, { ...CLIENT }], email_change_requests: [], notification_log: [], center_settings: [] };
  sent.length = 0;
};
const as = (p: typeof ADMIN | null) => { g.__fakeUser = p ? { id: p.id, email: p.email } : null; };
const action = (id: string, email: string) => {
  const fd = new FormData(); fd.set("newEmail", email);
  return requestTrainerEmailChangeAction(id, {}, fd);
};
const reqs = () => fake.tables.email_change_requests;

console.log(`\nBranca real (USE_MOCK = ${USE_MOCK})`);
check(!USE_MOCK, "es prova la branca de Supabase");

console.log("\nQui ho pot fer");
for (const who of [LAIA, CLIENT, null] as const) {
  reset(); as(who);
  const r = await action(LAIA.id, "laiamillans02@gmail.com");
  const d = await requestEmailChangeByAdmin({ profileId: LAIA.id, newEmail: "laiamillans02@gmail.com" });
  check(r.error === "No autoritzat." && d === "unauthorized" && reqs().length === 0 && sent.length === 0, `${who?.role ?? "sense sessió"}: «No autoritzat», cap petició ni correu`);
}

console.log("\nA qui");
reset(); as(ADMIN);
check((await action(CLIENT.id, "nou@exemple.cat")).error?.startsWith("Només es pot canviar així") === true && reqs().length === 0, "el correu d'un client, no");
check((await action(ADMIN.id, "nou@exemple.cat")).error?.startsWith("Només es pot canviar així") === true && reqs().length === 0, "el d'un admin, tampoc");
check((await action("no-existeix", "nou@exemple.cat")).error === "Aquest professional no té compte d'accés.", "un perfil que no existeix: error");

console.log("\nCorreus que no valen");
check((await action(LAIA.id, "sense-arrova")).error === "Aquest correu no sembla vàlid.", "invàlid");
check((await action(LAIA.id, " LAIA@vindibcn.com ")).error === "És el correu que ja té.", "el mateix (majúscules i espais inclosos)");
check((await action(LAIA.id, "Ana@Exemple.cat")).error === "Aquest correu ja el fa servir un altre compte del centre.", "el d'un altre compte");
check(reqs().length === 0 && sent.length === 0, "cap d'aquests ha creat res ni ha enviat res");

console.log("\nEl bo");
const r = await action(LAIA.id, "LaiaMillans02@gmail.com ");
check(!r.error && r.sentTo === "laiamillans02@gmail.com", `enviat a ${r.sentTo}`);
check(reqs().length === 1 && reqs()[0].new_email === "laiamillans02@gmail.com" && /^[0-9a-f]{64}$/.test(String(reqs()[0].token_hash)), "una petició, amb el secret només en hash");
const toNew = sent.find((m) => m.to === "laiamillans02@gmail.com");
const toOld = sent.find((m) => m.to === "laia@vindibcn.com");
const secret = toNew?.html.match(/confirm-email\?r=([A-Za-z0-9_-]+)/)?.[1];
check(!!toNew && !!secret, "el correu nou porta l'enllaç de confirmació");
check(!!toOld && !/confirm-email|href="https:\/\/app\.test\/auth/.test(toOld.html), "el vell rep l'avís, sense cap enllaç de confirmació");
check(sent.length === 2, `només dos correus (${sent.length})`);
check(/L'administració del centre ha demanat/.test(toNew!.text) && /L'administració del centre ha demanat/.test(toOld!.text), "tots dos diuen que ho ha demanat l'administració (en català)");
check(!secret || !JSON.stringify(fake.tables).includes(secret), "el secret de l'enllaç no és enlloc de la base");
const log = fake.tables.notification_log;
check(log.some((l) => l.event_type === "auth_email_change" && l.recipient === "laiamillans02@gmail.com" && l.status === "sent") && log.some((l) => l.event_type === "auth_email_change_alert" && l.recipient === "laia@vindibcn.com"), "tots dos al notification_log");
check(fake.tables.profiles.find((p) => p.id === LAIA.id)?.email === "laia@vindibcn.com", "el correu NO canvia fins a la confirmació");

console.log("\nUna segona petició");
const again = await action(LAIA.id, "altre@gmail.com");
check(again.error?.startsWith("Fa menys de 5 minuts") === true && reqs().length === 1, "abans de 5 minuts: «espera», cap petició nova");
reqs()[0].created_at = new Date(Date.now() - 10 * 60_000).toISOString();
const third = await action(LAIA.id, "altre@gmail.com");
check(!third.error && reqs().length === 2 && !!reqs()[0].consumed_at && !reqs()[1].consumed_at, "passats 5 minuts: la primera queda anul·lada i només val l'última");

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
