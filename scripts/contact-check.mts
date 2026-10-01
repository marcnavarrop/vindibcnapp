/**
 * El contacte del centre (0100): mai un text provisional, mai una línia buida,
 * i el Reply-To només on toca. En simulació, sense enviar res:
 *
 *   npm run contact:check
 *
 *   · El telèfon i el correu es normalitzen i es validen com diu la 0100.
 *   · Correus: amb contacte, el peu dels de clients i visitants el porta (amb
 *     tel: i mailto:) i el Reply-To és el correu de contacte; els del
 *     professional i de l'admin no porten ni una cosa ni l'altra. Sense correu
 *     de contacte, cap Reply-To i cap «respon a aquest correu».
 *   · Pàgines legals: amb dades i sense, en ca/es/en, cap [CLAUDÀTOR] ni «none».
 *   · Avisos interns: notify_email, si no el de contacte, si no CENTER_EMAIL.
 *   · L'esdeveniment de calendari porta l'adreça configurada (o només el nom).
 *
 * El manual del client ho comprova `npm run manual:check`.
 */
process.env.NEXT_PUBLIC_USE_MOCK = "true";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTranslator } from "next-intl";

const STORE = path.join(os.tmpdir(), "vindibcn-mock.json");
const abans = fs.existsSync(STORE) ? fs.readFileSync(STORE, "utf8") : null;
const restaura = () => {
  if (abans === null) fs.rmSync(STORE, { force: true });
  else fs.writeFileSync(STORE, abans);
};

const { normalizePhone, normalizeEmail, normalizeTaxId, telHref } = await import("../lib/center-contact");
const T = await import("../lib/notifications/templates");
const { getStore, saveStore } = await import("../lib/mock/store");
const { internalNotifyEmail } = await import("../lib/data/center-settings");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

const FULL = { phone: "+34 931 23 45 67", whatsapp: true, email: "recepcio@exemple.cat", address: "Carrer Gran, 1, 08012 Barcelona" };
const PHONE_ONLY = { phone: "+34 931 23 45 67", whatsapp: false, email: null, address: null };
const NONE = { phone: null, whatsapp: false, email: null, address: null };
const REPLY = /respon a aquest|responde a este|reply to this/i;

try {
  console.log("\nTelèfon i correu");
  const ph = (s: string) => {
    const r = normalizePhone(s);
    return "value" in r ? r.value : `ERROR`;
  };
  check(ph("931234567") === "+34 931 23 45 67", `«931234567» → ${ph("931234567")}`);
  check(ph("93-123-45-67") === "+34 931 23 45 67", "«93-123-45-67» → +34 931 23 45 67");
  check(ph("+34 600 100 200") === "+34 600 10 02 00", `«+34 600 100 200» → ${ph("+34 600 100 200")}`);
  check(ph("0034 931234567") === "+34 931 23 45 67", "«0034…» → +34");
  check(ph("+44 20 7946 0958") === "+44 2079460958", `estranger: ${ph("+44 20 7946 0958")}`);
  check(ph("12345") === "ERROR" && ph("93 123 abc") === "ERROR", "massa curt o amb lletres → error");
  check(ph("") === null, "buit → null");
  check(/^\+?[0-9][0-9 ]{7,18}[0-9]$/.test(ph("931234567")!), "el que es desa passa el check de la 0100");
  check(telHref("+34 931 23 45 67") === "tel:+34931234567", "tel:+34931234567");
  const em = normalizeEmail("  Recepcio@Exemple.CAT ");
  check("value" in em && em.value === "recepcio@exemple.cat", "correu: espais fora i en minúscules");
  check("error" in normalizeEmail("sense-arrova"), "correu sense @ → error");
  const nif = normalizeTaxId(" b 1234567 8 ");
  check("value" in nif && nif.value === "B12345678", "NIF: majúscules i sense espais");

  console.log("\nCorreus");
  const community = (contact: typeof FULL | typeof NONE) =>
    T.renderEmail(
      { type: "community", recipient: { profileId: "p", email: "a@b.c", phone: null, name: "Ana", locale: "es" }, relatedId: "x", data: { name: "Ana", title: "Hola", body: "Text" } },
      contact,
    );
  const c1 = community(FULL);
  check(c1.replyTo === "recepcio@exemple.cat", "client, amb contacte: Reply-To = correu de contacte");
  check(c1.html.includes('href="tel:+34931234567"') && c1.html.includes('href="mailto:recepcio@exemple.cat"') && c1.html.includes("wa.me/34931234567"), "peu: tel:, WhatsApp i mailto:");
  check(/Contacto: 931 23 45 67 \(WhatsApp\) · recepcio@exemple\.cat/.test(c1.text), "text pla: «Contacto: 931 23 45 67 (WhatsApp) · …» (en castellà)");
  const c0 = community(NONE);
  check(c0.replyTo === null && !c0.html.includes("data-contact") && !/Contact[eo]?:/.test(c0.text), "client, sense contacte: ni Reply-To ni línia");
  const cp = community(PHONE_ONLY);
  check(cp.replyTo === null && cp.html.includes("tel:+34931234567") && !cp.html.includes("mailto:"), "només telèfon: línia amb el telèfon i cap Reply-To");
  const tr = T.renderEmail(
    { type: "trainer_booking_received", recipient: { profileId: "t", email: "t@b.c", phone: null, name: "Laia", locale: null }, relatedId: "r", data: { name: "Laia", client: "Ana", when: "dl" } },
    FULL,
  );
  check(tr.replyTo === null && !tr.html.includes("data-contact"), "professional: ni Reply-To ni contacte al peu");
  for (const locale of ["ca", "es", "en"] as const) {
    const w1 = T.renderWelcomeEmail({ name: "Ana", url: "https://x", locale, contact: FULL });
    const w0 = T.renderWelcomeEmail({ name: "Ana", url: "https://x", locale, contact: NONE });
    const wp = T.renderWelcomeEmail({ name: "Ana", url: "https://x", locale, contact: PHONE_ONLY });
    check(REPLY.test(w1.text) && w1.replyTo === "recepcio@exemple.cat", `benvinguda (${locale}), amb correu: «respon…» i Reply-To`);
    check(!REPLY.test(w0.text) && !REPLY.test(w0.html) && w0.replyTo === null, `benvinguda (${locale}), sense contacte: cap «respon…» ni Reply-To`);
    check(!REPLY.test(wp.text) && wp.replyTo === null, `benvinguda (${locale}), només telèfon: cap «respon…»`);
  }
  const trial = (contact: typeof FULL | typeof NONE) =>
    T.renderEmail({ type: "trial_status", recipient: { profileId: null, email: "v@b.c", phone: null, name: "Clara", locale: null }, relatedId: "t", data: { name: "Clara", status: "confirmed", when: "dl" } }, contact);
  check(REPLY.test(trial(FULL).text) && trial(FULL).replyTo === "recepcio@exemple.cat", "prova confirmada, amb correu: «respon…» i Reply-To");
  check(!REPLY.test(trial(NONE).text) && trial(NONE).replyTo === null, "prova confirmada, sense correu: cap «respon…»");
  const inv = T.renderInviteEmail({ name: "Ana", url: "https://x", contact: FULL });
  check(inv.replyTo === "recepcio@exemple.cat" && inv.html.includes("tel:+34931234567"), "invitació (compte): peu amb contacte i Reply-To");

  console.log("\nCalendari");
  const { buildCalendarEvent } = await import("../lib/calendar-links");
  const ev = (address: string | null) =>
    buildCalendarEvent({ serviceType: "ep_individual", otherPartyName: "Laia", scheduledAt: "2026-10-05T08:00:00Z", address }).location;
  check(ev("Carrer Gran, 1, 08012 Barcelona") === "VindiBCN, Carrer Gran, 1, 08012 Barcelona", "amb adreça: «VindiBCN, <adreça>»");
  check(ev(null) === "VindiBCN", "sense adreça: només «VindiBCN» (res escrit a mà)");

  console.log("\nPàgines legals");
  for (const locale of ["ca", "es", "en"] as const) {
    const messages = JSON.parse(fs.readFileSync(`messages/${locale}.json`, "utf8"));
    const t = createTranslator({ locale, messages, namespace: "legalPages" });
    for (const [name, v] of [
      ["amb dades", { name: "Vindi BCN SL", nif: "B12345678", address: "Carrer Gran, 1", email: "recepcio@exemple.cat" }],
      ["buides", { name: "none", nif: "none", address: "none", email: "none" }],
    ] as const) {
      const vals = { ...v, mail: (ch: string) => ch, b: (ch: string) => ch };
      const texts = ["avisLegal.p1", "privacitat.p1", "privacitat.p8"].map((k) => String(t.markup(k as never, vals as never)));
      const bad = texts.filter((x) => /\[[A-Z_]{3,}\]|none|\s\.|,\s*\./.test(x));
      check(bad.length === 0, `${locale}, ${name}: «${texts[0].slice(0, 70)}…»${bad.length ? ` → ${bad.join(" | ")}` : ""}`);
      if (name === "amb dades") check(texts[0].includes("B12345678") && texts[2].includes("recepcio@exemple.cat"), `${locale}: hi surten el NIF i el correu`);
    }
  }

  console.log("\nAvisos interns");
  const set = (notify: string | null, email: string | null) => {
    const s = getStore();
    s.centerSettings = { ...s.centerSettings!, notify_email: notify, contact_email: email };
    saveStore(s);
  };
  process.env.CENTER_EMAIL = "env@exemple.cat";
  set("avisos@exemple.cat", "recepcio@exemple.cat");
  check((await internalNotifyEmail()) === "avisos@exemple.cat", "amb notify_email: aquest");
  set(null, "recepcio@exemple.cat");
  check((await internalNotifyEmail()) === "recepcio@exemple.cat", "sense: el de contacte");
  set(null, null);
  check((await internalNotifyEmail()) === "env@exemple.cat", "sense cap dels dos: CENTER_EMAIL");
  delete process.env.CENTER_EMAIL;
  check((await internalNotifyEmail()) === null, "sense res: no s'envia (null)");
} catch (e) {
  console.error(e);
  fallides++;
} finally {
  restaura();
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
