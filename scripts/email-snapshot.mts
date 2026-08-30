/**
 * Renderitza TOTS els correus amb dades fixes i escriu el resultat a disc.
 *
 * Serveix per a una cosa concreta: fer un `diff` abans i després d'un canvi
 * de fontaneria i veure, sense interpretar-ho, si algun correu ha canviat.
 * Les dades són inventades però constants —cap `new Date()`— perquè dues
 * execucions seguides han de donar byte a byte el mateix.
 *
 *   npx tsx scripts/email-snapshot.mts <carpeta>
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  renderEmail,
  renderInviteEmail,
  renderRecoveryEmail,
  renderWelcomeEmail,
} from "../lib/notifications/templates";
import type { NotificationEvent, NotificationEventType } from "../lib/notifications/types";

const out = process.argv[2];
if (!out) throw new Error("Cal indicar la carpeta de sortida.");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// La cadena i l'ISO han de ser la MATEIXA data: abans del canvi la plantilla
// rep el text ja fet, i després el construeix ella a partir de l'ISO. Si no
// coincidissin, el diff marcaria diferències que no són del canvi.
const WHEN_ISO = "2026-03-16T09:00:00.000Z";
const WHEN = "dilluns, 16 de març, a les 10:00";
const EXPIRES_ISO = "2026-03-22T12:00:00.000Z";
const EXPIRES = "22 de març del 2026";

/*
 * Cada data i cada servei van amb les DUES claus: la vella (text ja fet) i la
 * nova (cru), amb el mateix valor. Així un sol fitxer de dades val per a la
 * versió d'abans i la de després, i el diff compara només el que ha canviat
 * al codi —no el que he canviat jo a les dades—.
 */
const WHENS = { when: WHEN, whenIso: WHEN_ISO };
const svc = (label: string, type: string) => ({ service: label, serviceType: type });
const GRUP = svc("Grup reduït", "grupo_reducido");
const INDIV = svc("EP Individual", "ep_individual");
const FISIO = svc("Fisioteràpia", "fisioterapia");
const rec = { profileId: "p-1", email: "algu@example.com", phone: null, name: "Ana Ferrer" };

/**
 * Si es passa un locale, la carpeta porta el sufix. Serveix per comprovar dues
 * coses oposades: al bloc 1, que un destinatari en castellà rep EXACTAMENT el
 * mateix que un en català; i als blocs 2 i 3, que ja no.
 */
const LOCALE = process.argv[3] as "ca" | "es" | "en" | undefined;

/**
 * Els correus que van a l'admin, al professional, a un visitant sense compte
 * o al desenvolupador NO porten idioma al destinatari: `getProfileContact`
 * només el retorna per als clients. Aquí es reprodueix aquesta regla, perquè
 * si no el fixture els donaria un idioma que a la realitat no tenen mai.
 */
const INTERN = new Set<NotificationEventType>([
  "trial_request",
  "trial_status",
  "trainer_booking_received",
  "trainer_booking_cancelled",
  "trainer_daily_agenda",
  "new_client_registered",
  "invoice_generated",
  "support_ticket_created",
]);

const recFor = (type: NotificationEventType) => ({
  ...rec,
  locale: INTERN.has(type) ? null : (LOCALE ?? null),
});

/** Un `data` per tipus, amb totes les claus que la plantilla pugui llegir. */
const DATA: Record<NotificationEventType, Record<string, string>> = {
  reservation_confirmed: { name: "Ana Ferrer", ...WHENS, ...GRUP, trainer: "Laia Puig" },
  reservation_cancelled: { name: "Ana Ferrer", ...WHENS, ...INDIV },
  session_reminder: { name: "Ana Ferrer", ...WHENS, ...FISIO, trainer: "Jordi Roca" },
  trial_request: { name: "Laia Puig", visitorName: "Marta Gil", ...WHENS, phone: "600111222", email: "marta@example.com" },
  trial_status: { name: "Marta Gil", ...WHENS, status: "confirmed" },
  bono_low: { name: "Ana Ferrer", ...INDIV },
  bono_expiring_soon: { name: "Ana Ferrer", ...INDIV, remaining: "3", when: `el ${EXPIRES}`, expiresAt: EXPIRES, expiresIso: EXPIRES_ISO },
  bono_unpaid_cancelled: { name: "Ana Ferrer", ...INDIV, cancelled: "2" },
  community: { name: "Ana Ferrer", title: "Nou grup de mobilitat", body: "Comencem els dimarts a les 18 h." },
  trainer_booking_received: { name: "Laia Puig", client: "Ana Ferrer", ...WHENS, ...GRUP },
  trainer_booking_cancelled: { name: "Laia Puig", client: "Ana Ferrer", ...WHENS, ...GRUP },
  trainer_daily_agenda: { name: "Laia Puig", sessions: JSON.stringify([{ time: "10:00", client: "Ana Ferrer", ...GRUP }, { time: "11:00", client: "Pau Riera", ...INDIV }]) },
  new_client_registered: { name: "Marc Navarro", client: "Nova Clienta", clientEmail: "nova@example.com", url: "https://exemple/admin/clients/x" },
  new_exercises_assigned: { name: "Ana Ferrer" },
  invoice_generated: { name: "Laia Puig", period: "Març 2026", total: "1.240,00 €" },
  waitlist_fulfilled: { name: "Ana Ferrer", ...WHENS, ...GRUP, trainer: "Laia Puig" },
  gift_voucher_redeemed: { name: "Ana Ferrer", code: "VINDI-AB12-CD34", package: "EP Individual · 5 sessions", packageName: "EP Individual", sessions: "5", buyer: "Pau Riera" },
  gift_voucher_gifted: { name: "Laura", recipient: "Laura", buyer: "Ana Ferrer", code: "VINDI-AB12-CD34", package: "EP Individual · 5 sessions", packageName: "EP Individual", sessions: "5", expires: EXPIRES, expiresIso: EXPIRES_ISO, message: "Per molts anys!" },
  support_ticket_created: { reporter: "Laia Puig", area: "trainer", title: "El calendari no carrega", category: "bug", description: "En obrir Reserves surt en blanc.", ...WHENS },
};

const TYPES = Object.keys(DATA) as NotificationEventType[];

function save(nom: string, e: { subject: string; html: string; text: string }) {
  writeFileSync(join(out, `${nom}.subject.txt`), e.subject + "\n");
  writeFileSync(join(out, `${nom}.html`), e.html);
  writeFileSync(join(out, `${nom}.txt`), e.text);
}

for (const type of TYPES) {
  const event: NotificationEvent = {
    type,
    recipient: recFor(type),
    data: DATA[type],
  };
  save(type, renderEmail(event));
}
// `trial_status` té dues cares; la de rebuig també s'ha de vigilar.
save("trial_status__rejected", renderEmail({ type: "trial_status", recipient: recFor("trial_status"), data: { ...DATA.trial_status, status: "rejected" } }));
// I l'agenda buida, que canvia el text d'entrada.
save("trainer_daily_agenda__buida", renderEmail({ type: "trainer_daily_agenda", recipient: recFor("trainer_daily_agenda"), data: { name: "Laia Puig", sessions: "[]" } }));

save("auth_invite", renderInviteEmail({ name: "Ana Ferrer", url: "https://exemple/auth/update-password?token_hash=x&type=invite" }));
save("auth_recovery", renderRecoveryEmail({ name: "Ana Ferrer", url: "https://exemple/auth/update-password?token_hash=x&type=recovery" }));
save("auth_welcome", renderWelcomeEmail({ name: "Ana Ferrer", url: "https://exemple/client", locale: LOCALE ?? null }));

console.log(`${TYPES.length + 5} correus escrits a ${out}`);
