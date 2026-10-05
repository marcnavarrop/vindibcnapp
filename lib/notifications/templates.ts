import "server-only";
import type { NotificationEvent } from "@/lib/notifications/types";
import { staticI18n, type StaticI18n } from "@/lib/i18n/no-request";
import type { Locale } from "@/lib/i18n/config";
import { formatEur } from "@/lib/labels";
import {
  BRAND,
  TONES,
  type Tone,
  CENTER_NAME,
  appLink,
  emailLogoUrl,
  EMAIL_LOGO_SIZE,
} from "@/lib/notifications/brand";
import { displayPhone, hasContact, telHref, whatsappHref, type PublicContact } from "@/lib/center-contact";
import { buildCalendarEvent, buildGoogleCalendarUrl } from "@/lib/calendar-links";
import type { ServiceType } from "@/types/database";

/** Escapa text per evitar injecció d'HTML des de dades d'usuari. */
function esc(s: string): string {
  return (s ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

type DetailRow = { label: string; value: string; href?: string };
type Cta = { label: string; url: string };
/** Un avís que no es pot passar per alt: «encara no està pagat». */
type Notice = { tone: Tone; text: string };
/**
 * "internal": l'avís al desenvolupador (tiquet de suport). Ni contacte del
 * centre ni preferències: no és cap usuari del centre.
 */
type FooterKind = "client" | "trainer" | "admin" | "visitor" | "plain" | "internal";

type Block = {
  /** L'etiqueta d'estat de dalt de tot: «✓ Reserva confirmada». */
  eyebrow?: { tone: Tone; text: string };
  heading: string;
  /**
   * El text que la safata ensenya al costat de l'assumpte. Sense, el primer
   * paràgraf després de la salutació (o l'únic que hi hagi).
   */
  preheader?: string;
  intro: string[]; // paràgrafs (text pla: s'escapen aquí)
  /** El dia i l'hora en gran, dins de la targeta. `plain` és la línia del text pla. */
  hero?: { date: string; time: string; plain: string };
  details?: DetailRow[];
  /** Avisos que s'han de llegir ABANS del botó. */
  notices?: Notice[];
  cta?: Cta;
  /** Enllaços secundaris sota el botó («Afegir a Google Calendar»). */
  links?: Cta[];
  /** Després del botó: paràgrafs, o un avís si el text és un consell que compta. */
  outro?: (string | Notice)[];
  footer: FooterKind;
};

// ─────────────────────────── Peces (taules, inline) ───────────────────────────
//
// Un sol esquelet (`layout`) i peces petites. Tot amb taules i estils en línia,
// i la font a CADA element de text: Outlook d'escriptori no l'hereta de la
// taula de fora i, si no la troba, cau a Times New Roman.

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
/** Títols: Georgia, la serif que hi ha a tots els equips (la de l'app és Lora). */
const SERIF = "Georgia,'Times New Roman',serif";

function paragraph(text: string): string {
  // intro/outro són text pla: s'escapen aquí i es respecten els salts de línia.
  const safe = esc(text).replace(/\n/g, "<br>");
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:24px;color:${BRAND.charcoal};">${safe}</p>`;
}

function eyebrow(e: { tone: Tone; text: string }): string {
  const [fg, bg] = TONES[e.tone];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td style="background:${bg};border-radius:999px;padding:5px 12px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${fg};">${esc(e.text)}</td></tr></table>`;
}

function headingHtml(text: string): string {
  return `<h1 class="serif" style="margin:0 0 18px;font-family:${SERIF};font-size:26px;line-height:32px;font-weight:700;color:${BRAND.dark};">${esc(text)}</h1>`;
}

/**
 * La targeta de detalls: l'etiqueta DAMUNT del valor, no al costat. Així una
 * data llarga es llegeix sencera a 375 px en comptes de partir-se en tres
 * línies dins d'una columna estreta. Si hi ha `hero`, el dia i l'hora van a
 * dalt, en gran.
 */
function detailsCard(rows: DetailRow[], hero?: Block["hero"]): string {
  const heroHtml = hero
    ? `<tr><td style="padding:20px 20px 16px;${rows.length ? `border-bottom:1px solid ${BRAND.border};` : ""}">
        <div style="font-family:${SANS};font-size:14px;line-height:20px;color:${BRAND.soft};">${esc(hero.date)}</div>
        <div class="serif" style="font-family:${SERIF};font-size:32px;line-height:38px;font-weight:700;color:${BRAND.purple};">${esc(hero.time)}</div>
      </td></tr>`
    : "";
  const rowsHtml = rows
    .map((r, idx) => {
      const value = r.href
        ? `<a href="${esc(r.href)}" target="_blank" style="color:${BRAND.dark};text-decoration:underline;">${esc(r.value)}</a>`
        : esc(r.value);
      return `<tr><td style="padding:12px 20px;${idx < rows.length - 1 ? `border-bottom:1px solid ${BRAND.border};` : ""}">
        <div style="font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${BRAND.soft};">${esc(r.label)}</div>
        <div style="font-family:${SANS};font-size:16px;line-height:22px;font-weight:600;color:${BRAND.dark};padding-top:2px;">${value}</div>
      </td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid ${BRAND.border};border-left:4px solid ${BRAND.purple};border-radius:12px;margin:4px 0 24px;background:${BRAND.white};">${heroHtml}${rowsHtml}</table>`;
}

function noticeHtml(n: Notice): string {
  const [fg, bg] = TONES[n.tone];
  const safe = esc(n.text).replace(/\n/g, "<br>");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="background:${bg};border-left:4px solid ${fg};border-radius:8px;padding:14px 16px;font-family:${SANS};font-size:15px;line-height:22px;color:${fg};">${safe}</td></tr></table>`;
}

/**
 * Botó «a prova de bales». Outlook d'escriptori ignora el padding d'un `<a>`
 * (el botó quedava enganxat al text i només la paraula era clicable): allà es
 * pinta amb VML. La resta veu una cel·la amb el padding a l'enllaç, 48 px
 * d'alt, i al mòbil ocupa tota l'amplada (`.btn`).
 */
function ctaButton(cta: Cta): string {
  const url = esc(cta.url);
  const width = Math.min(520, Math.max(220, cta.label.length * 9 + 64));
  return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="20%" stroke="f" fillcolor="${BRAND.purple}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${esc(cta.label)}</center></v:roundrect><![endif]-->
  <!--[if !mso]><!--><table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:0 0 24px;"><tr><td align="center" bgcolor="${BRAND.purple}" style="border-radius:10px;background:${BRAND.purple};">
    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:10px;">${esc(cta.label)}</a>
  </td></tr></table><!--<![endif]-->`;
}

function linksHtml(links: Cta[]): string {
  const a = links
    .map((l) => `<a href="${esc(l.url)}" target="_blank" style="color:${BRAND.purple};text-decoration:underline;font-weight:600;">${esc(l.label)}</a>`)
    .join(`&nbsp;&nbsp;·&nbsp;&nbsp;`);
  return `<p style="margin:-8px 0 24px;font-family:${SANS};font-size:14px;line-height:22px;color:${BRAND.soft};">${a}</p>`;
}

/** L'enllaç al mapa d'una adreça. */
function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`VindiBCN, ${address}`)}`;
}

function footer(kind: FooterKind, i: StaticI18n, contact?: PublicContact | null): string {
  const f = i.ns("emails.footer");
  const link = (href: string, text: string) =>
    `<a href="${esc(href)}" target="_blank" style="color:${BRAND.soft};text-decoration:underline;">${esc(text)}</a>`;
  const line = (html: string, attr = "") =>
    `<p${attr} style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:20px;color:${BRAND.soft};">${html}</p>`;
  const privacy = link(appLink("/legal/privacitat"), f("privacy"));
  let prefsLine = "";
  if (kind === "client")
    prefsLine = f("clientPrefs", { link: link(appLink("/client/configuracio"), f("settings")) });
  else if (kind === "trainer")
    prefsLine = `Pots gestionar els teus avisos des de la teva àrea, a ${link(appLink("/trainer/configuracio"), "Configuració")}.`;
  else if (kind === "admin")
    prefsLine = `Pots gestionar els teus avisos a ${link(appLink("/admin/configuracio"), "Configuració")}.`;
  else if (kind === "visitor")
    prefsLine = `Has rebut aquest correu perquè has demanat una sessió de prova a ${CENTER_NAME}.`;
  // "plain" i "internal": només marca + privacitat.

  const lines = [line(`<strong style="color:${BRAND.charcoal};">${CENTER_NAME}</strong> · ${esc(f("tagline"))}`)];
  if (OUTSIDE.includes(kind) && contact?.address) lines.push(line(link(mapsUrl(contact.address), contact.address)));
  const c = contactFooterHtml(kind, i, contact);
  if (c) lines.push(c);
  lines.push(line(`${prefsLine ? `${prefsLine} · ` : ""}${privacy}`));
  return lines.join("");
}

/**
 * L'esquelet de TOTS els correus.
 *
 *   · Preheader amagat: el que la safata ensenya després de l'assumpte.
 *   · Per a Outlook d'escriptori, una taula de 600 px (no entén `max-width`) i
 *     la font forçada (si no, Times New Roman).
 *   · Al mòbil (<520 px), la targeta ocupa tota l'amplada sense marges i el
 *     botó també. On no s'entenen les media queries, es veu la de 600 px
 *     encongida, que també funciona.
 *   · Només mode clar, com l'app: Apple Mail ho respecta; Gmail al mòbil i
 *     Outlook.com inverteixen igualment, i no es pot evitar des de l'HTML.
 */
function layout(block: Block, i: StaticI18n, contact?: PublicContact | null): string {
  const body: string[] = [];
  if (block.eyebrow) body.push(eyebrow(block.eyebrow));
  body.push(headingHtml(block.heading));
  for (const p of block.intro) body.push(paragraph(p));
  if (block.hero || (block.details && block.details.length)) body.push(detailsCard(block.details ?? [], block.hero));
  for (const n of block.notices ?? []) body.push(noticeHtml(n));
  if (block.cta) body.push(ctaButton(block.cta));
  if (block.links && block.links.length) body.push(linksHtml(block.links));
  for (const o of block.outro ?? []) body.push(typeof o === "string" ? paragraph(o) : noticeHtml(o));

  const { width, height } = EMAIL_LOGO_SIZE;
  // Caràcters invisibles darrere del preheader: si no, la safata hi enganxa el
  // començament del cos («Hola Ana…»).
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);

  return `<!doctype html>
<html lang="${i.locale}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${esc(block.heading)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>td,p,a,h1,div{font-family:Arial,sans-serif !important;}.serif{font-family:Georgia,serif !important;}</style><![endif]-->
<style>:root{color-scheme:light only;supported-color-schemes:light only;}
@media (max-width:520px){.outer{padding:0 !important}.card{border-radius:0 !important;border-left:0 !important;border-right:0 !important}.px{padding-left:20px !important;padding-right:20px !important}.btn{width:100% !important}.btn a{display:block !important}.foot{padding:20px 20px 32px !important}}
</style></head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.bg};">${esc(preheaderOf(block))}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};"><tr><td align="center" class="outer" style="padding:24px 12px;">
  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="max-width:600px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
    <tr><td align="center" bgcolor="${BRAND.purple}" style="background:${BRAND.purple};padding:22px 32px;">${brandHeader(width, height)}</td></tr>
    <tr><td class="px" style="padding:32px 36px 12px;">${body.join("")}</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;"><tr><td class="foot" align="center" style="padding:20px 24px 8px;text-align:center;">${footer(block.footer, i, contact)}</td></tr></table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}

/**
 * Capçalera de marca: el logotip oficial, el mateix fitxer que la resta de
 * l'app, centrat damunt del lila.
 *
 * L'`alt` porta estil propi perquè, quan un client bloqueja les imatges (i
 * Outlook i Gmail ho fan per defecte amb remitents desconeguts), el que quedi
 * sigui "VindiBCN" en blanc i gros damunt del lila, no el text diminut i
 * negre per defecte.
 */
function brandHeader(width: number, height: number): string {
  return `<img src="${emailLogoUrl()}" width="${width}" height="${height}" alt="${CENTER_NAME}" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;font-family:${SANS};font-size:20px;font-weight:800;color:${BRAND.white};">`;
}

function preheaderOf(block: Block): string {
  if (block.preheader) return block.preheader;
  return block.intro.length > 1 ? block.intro[1] : (block.intro[0] ?? block.heading);
}

/** Versió text pla a partir dels mateixos continguts (entregabilitat + fallback). */
function plain(block: Block, i: StaticI18n, contact?: PublicContact | null): string {
  const lines: string[] = [block.heading, ""];
  lines.push(...block.intro);
  if (block.hero || (block.details && block.details.length)) {
    lines.push("");
    if (block.hero) lines.push(block.hero.plain);
    for (const r of block.details ?? []) lines.push(`${r.label}: ${r.value}`);
  }
  if (block.notices && block.notices.length) {
    lines.push("");
    lines.push(...block.notices.map((n) => n.text));
  }
  if (block.cta) {
    lines.push("");
    lines.push(`${block.cta.label}: ${block.cta.url}`);
  }
  for (const l of block.links ?? []) lines.push(`${l.label}: ${l.url}`);
  if (block.outro && block.outro.length) {
    lines.push("");
    lines.push(...block.outro.map((o) => (typeof o === "string" ? o : o.text)));
  }
  const f = i.ns("emails.footer");
  lines.push("", "—", `${CENTER_NAME} · ${f("tagline")}`);
  if (OUTSIDE.includes(block.footer) && contact?.address) lines.push(contact.address);
  const contactLine = contactFooterText(block.footer, i, contact);
  if (contactLine) lines.push(contactLine);
  if (block.footer === "client")
    lines.push(f("managePlain", { url: appLink("/client/configuracio") }));
  else if (block.footer === "trainer")
    lines.push(`Gestiona els teus avisos: ${appLink("/trainer/configuracio")}`);
  lines.push(f("privacyPlain", { url: appLink("/legal/privacitat") }));
  return lines.join("\n");
}

// ─────────────────────────── Plantilles per esdeveniment ───────────────────────────

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  /**
   * La bústia on van les respostes: el correu de contacte del centre, i NOMÉS
   * en els correus a clients i visitants, i NOMÉS si està informat. El
   * remitent (NOTIFICATIONS_FROM_EMAIL) no es llegeix: sense aquest camp, no
   * s'ha de convidar ningú a respondre.
   */
  replyTo: string | null;
};

/** Qui rep aquest peu és de fora (client o visitant): se li ensenya el contacte. */
const OUTSIDE: FooterKind[] = ["client", "visitor", "plain"];

function replyToFor(block: Block, contact: PublicContact | null | undefined): string | null {
  return OUTSIDE.includes(block.footer) && contact?.email ? contact.email : null;
}

/** Es pot convidar a «respondre a aquest correu»? Només si hi ha on arribar. */
function canReply(contact: PublicContact | null | undefined): boolean {
  return !!contact?.email;
}

/** La línia de contacte del peu (HTML), o res. */
function contactFooterHtml(kind: FooterKind, i: StaticI18n, contact: PublicContact | null | undefined): string {
  if (!OUTSIDE.includes(kind) || !contact || !hasContact(contact)) return "";
  const wa = i.ns("contact")("whatsapp");
  const link = (href: string, text: string) =>
    `<a href="${esc(href)}" target="_blank" style="color:${BRAND.soft};text-decoration:underline;">${esc(text)}</a>`;
  const parts: string[] = [];
  if (contact.phone)
    parts.push(
      link(telHref(contact.phone), displayPhone(contact.phone)) +
        (contact.whatsapp ? ` (${link(whatsappHref(contact.phone), wa)})` : ""),
    );
  if (contact.email) parts.push(link(`mailto:${contact.email}`, contact.email));
  return `<p style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:20px;color:${BRAND.soft};" data-contact>${parts.join(" · ")}</p>`;
}

/** La mateixa línia, en text pla. */
function contactFooterText(kind: FooterKind, i: StaticI18n, contact: PublicContact | null | undefined): string | null {
  if (!OUTSIDE.includes(kind) || !contact || !hasContact(contact)) return null;
  const f = i.ns("emails.footer");
  const parts: string[] = [];
  if (contact.phone) parts.push(displayPhone(contact.phone) + (contact.whatsapp ? ` (${i.ns("contact")("whatsapp")})` : ""));
  if (contact.email) parts.push(contact.email);
  return `${f("contact")}: ${parts.join(" · ")}`;
}

/**
 * Les peces comunes dels correus d'una SESSIÓ al client: el dia i l'hora en
 * gran, servei, professional i lloc, i el preheader amb el mateix (així es
 * llegeix a la safata sense obrir-lo).
 */
function sessionParts(
  i: StaticI18n,
  d: Record<string, string>,
  contact: PublicContact | null | undefined,
  opts: { trainer?: boolean } = {},
): { hero?: Block["hero"]; rows: DetailRow[]; preheader?: string } {
  const tl = i.ns("emails.labels");
  const service = d.serviceType ? i.service(d.serviceType) : undefined;
  const hero = d.whenIso
    ? { date: i.weekdayDate(d.whenIso), time: i.time(d.whenIso), plain: `${tl("when")}: ${i.dateTime(d.whenIso)}` }
    : undefined;
  const trainer = opts.trainer === false ? undefined : d.trainer;
  const detail = rows([
    [tl("service"), service],
    [tl("trainer"), trainer],
  ]);
  // A la targeta, carrer i número («Carrer Gran, 1»): l'adreça sencera ja va
  // al peu, i l'enllaç porta al mapa amb tota.
  if (contact?.address)
    detail.push({ label: tl("place"), value: contact.address.split(", ").slice(0, 2).join(", "), href: mapsUrl(contact.address) });
  const preheader = hero
    ? [`${hero.date}, ${hero.time}`, service, trainer].filter(Boolean).join(" · ")
    : undefined;
  return { hero, rows: detail, preheader };
}

/**
 * «Afegir al calendari» sota el botó de la confirmació. Google, amb un enllaç
 * que ja porta l'esdeveniment; per a Apple i Outlook cal el fitxer .ics, que
 * en un correu només podria anar com a adjunt: es baixa des de la reserva, a
 * l'app, amb el botó que ja hi ha.
 */
function calendarLinks(i: StaticI18n, d: Record<string, string>, contact: PublicContact | null | undefined): Cta[] | undefined {
  if (!d.whenIso || !d.serviceType) return undefined;
  const tc = i.ns("labels.calendar");
  const t = i.ns("emails.calendar");
  const service = i.service(d.serviceType);
  const name = d.trainer?.trim() || null;
  const event = buildCalendarEvent({
    serviceType: d.serviceType as ServiceType,
    otherPartyName: name,
    scheduledAt: d.whenIso,
    address: contact?.address ?? null,
    text: {
      title: name ? tc("titleWith", { service, name }) : tc("title", { service }),
      description: name ? tc("descriptionWith", { service, name }) : tc("description", { service }),
    },
  });
  return [
    { label: t("google"), url: buildGoogleCalendarUrl(event) },
    { label: t("other"), url: appLink("/client/reservas") },
  ];
}

/** Email d'invitació (crear contrasenya) amb la marca. */
export function renderInviteEmail(input: {
  name: string | null;
  url: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
  /** El contacte del centre: peu i Reply-To. */
  contact?: PublicContact | null;
}): RenderedEmail {
  const i = staticI18n(input.locale);
  const hola = input.name?.trim() ? `Hola ${input.name.trim()},` : "Hola,";
  const block: Block = {
    heading: "Benvingut/da a VindiBCN",
    intro: [
      hola,
      "T'han donat d'alta al centre. Fes clic al botó per crear la teva contrasenya i començar a fer servir la teva àrea.",
    ],
    cta: { label: "Crear la meva contrasenya", url: input.url },
    outro: ["Si no esperaves aquest correu, ignora'l."],
    footer: "plain",
  };
  return {
    subject: "Benvingut/da a VindiBCN — crea la teva contrasenya",
    html: layout(block, i, input.contact),
    text: plain(block, i, input.contact),
    replyTo: replyToFor(block, input.contact),
  };
}

/** Email de restabliment de contrasenya amb la marca. */
export function renderRecoveryEmail(input: {
  name: string | null;
  url: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
  /** El contacte del centre: peu i Reply-To. */
  contact?: PublicContact | null;
}): RenderedEmail {
  const i = staticI18n(input.locale);
  const hola = input.name?.trim() ? `Hola ${input.name.trim()},` : "Hola,";
  const block: Block = {
    heading: "Restablir la contrasenya",
    intro: [
      hola,
      "Has demanat crear una contrasenya nova. Fes clic al botó per continuar:",
    ],
    cta: { label: "Crear contrasenya nova", url: input.url },
    outro: ["Si no ho has demanat tu, ignora aquest correu; la teva contrasenya no canviarà."],
    footer: "plain",
  };
  return {
    subject: "Restablir la teva contrasenya — VindiBCN",
    html: layout(block, i, input.contact),
    text: plain(block, i, input.contact),
    replyTo: replyToFor(block, input.contact),
  };
}

/** Email de benvinguda per a un client que s'ha registrat pel seu compte. */
export function renderWelcomeEmail(input: {
  name: string | null;
  url: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
  /** El contacte del centre: peu i Reply-To. */
  contact?: PublicContact | null;
}): RenderedEmail {
  const i = staticI18n(input.locale);
  const te = i.ns("emails");
  const t = i.ns("emails.welcome");
  const hola = input.name?.trim()
    ? te("greeting", { name: input.name.trim() })
    : te("greetingPlain");
  const block: Block = {
    heading: t("heading"),
    intro: [hola, t("intro")],
    cta: { label: t("cta"), url: input.url },
    // «Respon a aquest correu» només si hi ha on arribar (vegeu `canReply`).
    outro: [canReply(input.contact) ? t("outro") : t("outroNoReply")],
    footer: "client",
  };
  return {
    subject: t("subject"),
    html: layout(block, i, input.contact),
    text: plain(block, i, input.contact),
    replyTo: replyToFor(block, input.contact),
  };
}

/**
 * Email al correu NOU: l'únic dels dos que porta enllaç.
 *
 * L'enllaç NO és el de Supabase sinó un de nostre, amb un secret opac que no
 * val res per si sol: la verificació la fa el servidor quan la pàgina la
 * demana amb JS. El motiu és el mateix que a `/auth/update-password` —que un
 * escàner d'enllaços no consumeixi el que ha de consumir una persona— però
 * aquí calia una altra peça, perquè `verifyOtp` no accepta els tokens de canvi
 * de correu (comprovat; la 0078 ho explica).
 */
export function renderEmailChangeEmail(input: {
  name: string | null;
  url: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
  /** El contacte del centre: peu i Reply-To. */
  contact?: PublicContact | null;
  /** L'ha demanat l'administració (canvi del correu d'un professional). */
  byAdmin?: boolean;
}): RenderedEmail {
  const i = staticI18n(input.locale);
  const te = i.ns("emails");
  const t = i.ns("emails.emailChange");
  const hola = input.name?.trim()
    ? te("greeting", { name: input.name.trim() })
    : te("greetingPlain");
  const block: Block = {
    heading: t("heading"),
    intro: [hola, input.byAdmin ? t("introByAdmin") : t("intro")],
    cta: { label: t("cta"), url: input.url },
    outro: [input.byAdmin ? t("outroByAdmin") : t("outro")],
    footer: "plain",
  };
  return {
    subject: t("subject"),
    html: layout(block, i, input.contact),
    text: plain(block, i, input.contact),
    replyTo: replyToFor(block, input.contact),
  };
}

/**
 * Avís al correu VELL. Deliberadament SENSE enllaç ni botó.
 *
 * Aquesta és la peça de seguretat de tot el flux. Supabase, pel seu compte,
 * també escriu a l'adreça antiga, però hi posa un enllaç VIU que completa el
 * canvi: comprovat contra el projecte real —un sol clic des del correu vell va
 * aplicar el canvi—. Això converteix l'avís que hauria de protegir la persona
 * en el botó que remata el robatori si algú li ha agafat la sessió.
 *
 * El nostre no ofereix cap acció. Només explica què s'ha demanat i què fer si
 * no ha estat ella. Per això el flux no fa servir el correu de Supabase.
 */
export function renderEmailChangeAlertEmail(input: {
  name: string | null;
  oldEmail: string;
  newEmail: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
  /** El contacte del centre: peu i Reply-To. */
  contact?: PublicContact | null;
  /** L'ha demanat l'administració (canvi del correu d'un professional). */
  byAdmin?: boolean;
}): RenderedEmail {
  const i = staticI18n(input.locale);
  const te = i.ns("emails");
  const t = i.ns("emails.emailChangeAlert");
  const hola = input.name?.trim()
    ? te("greeting", { name: input.name.trim() })
    : te("greetingPlain");
  const block: Block = {
    heading: t("heading"),
    intro: [
      hola,
      input.byAdmin
        ? t("introByAdmin", { old: input.oldEmail, new: input.newEmail })
        : t("intro", { old: input.oldEmail, new: input.newEmail }),
    ],
    outro: [input.byAdmin ? t("outroByAdmin") : t("outro")],
    footer: "plain",
  };
  return {
    subject: t("subject"),
    html: layout(block, i, input.contact),
    text: plain(block, i, input.contact),
    replyTo: replyToFor(block, input.contact),
  };
}

export function renderEmail(
  event: NotificationEvent,
  /** El contacte del centre: peu i Reply-To dels correus a clients i visitants. */
  contact?: PublicContact | null,
): RenderedEmail {
  // L'idioma surt del DESTINATARI, no de qui envia. Un mateix esdeveniment
  // —les novetats de la comunitat— arriba a clients i professionals dins del
  // mateix bucle, i cadascú l'ha de rebre en el seu.
  const i = staticI18n(event.recipient.locale);
  const d = event.data;
  const te = i.ns("emails");
  const tl = i.ns("emails.labels");
  const name = d.name?.trim() ? d.name.trim() : null;
  const hola = name ? te("greeting", { name }) : te("greetingPlain");

  /*
   * La data i el servei es formaten AQUÍ, no a qui crida `notify()`.
   *
   * Abans arribaven fets —sempre en català, perquè qui els construïa no sabia
   * per a qui era el correu—. Amb les plantilles traduïdes això hauria donat
   * "Date and time: dilluns, 16 de març": mitja frase en cada idioma. Ara el
   * `data` porta l'ISO i l'enum, i el format es decideix quan ja se sap en
   * quin idioma s'escriu.
   */
  const when = d.whenIso ? i.dateTime(d.whenIso) : undefined;
  const service = d.serviceType ? i.service(d.serviceType) : undefined;
  const expires = d.expiresIso ? i.date(d.expiresIso) : undefined;
  /*
   * El nom del paquet és una columna GUARDADA (`gift_vouchers.package_name`):
   * és el registre del que es va comprar i es queda tal com es va escriure,
   * com els preus. El recompte de sessions, en canvi, es genera en enviar, i
   * per tant sí que va en l'idioma de qui llegeix.
   */
  const pkg =
    d.packageName && d.sessions
      ? `${d.packageName} · ${te("sessions", { count: Number(d.sessions) })}`
      : d.package;

  let subject = "";
  let block: Block;

  switch (event.type) {
    case "reservation_confirmed": {
      const t = i.ns("emails.reservationConfirmed");
      const s = sessionParts(i, d, contact);
      subject = t("subject");
      block = {
        eyebrow: { tone: "success", text: `✓ ${t("eyebrow")}` },
        heading: t("heading"),
        preheader: s.preheader,
        intro: [hola, t("intro")],
        hero: s.hero,
        details: s.rows,
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        links: calendarLinks(i, d, contact),
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "reservation_cancelled": {
      const t = i.ns("emails.reservationCancelled");
      subject = t("subject");
      /*
       * Quan l'ha cancel·lat el CENTRE (0090) el correu ho diu, i diu què ha
       * passat amb la sessió sense prometre res que no sigui cert:
       *   · bono    → ha tornat al bo i la pot fer servir;
       *   · expired → ha tornat a un bo ja caducat: NO es podrà fer servir, i
       *               no se li fa creure el contrari;
       *   · none    → era de cortesia, no hi havia res a tornar.
       * Sense `byCenter` és el correu de sempre.
       */
      const byCenter = d.byCenter === "1";
      const refundLine =
        d.refund === "bono"
          ? t("refundBono")
          : d.refund === "expired"
            ? t("refundExpired")
            : d.refund === "none"
              ? t("refundNone")
              : null;
      const s = sessionParts(i, d, null);
      block = {
        eyebrow: { tone: byCenter ? "attention" : "neutral", text: t("eyebrow") },
        heading: t("heading"),
        preheader: s.preheader,
        intro: [hola, byCenter ? t("introByCenter") : t("intro")],
        hero: s.hero,
        details: s.rows,
        // Què ha passat amb la sessió es llegeix ABANS del botó: és el que
        // més importa d'aquest correu. Un bo caducat, en vermell.
        notices: refundLine
          ? [{ tone: d.refund === "expired" ? "error" : d.refund === "bono" ? "success" : "neutral", text: refundLine }]
          : undefined,
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: byCenter ? [t("outroByCenter")] : [t("outro")],
        footer: "client",
      };
      break;
    }
    case "reservation_rescheduled": {
      const t = i.ns("emails.reservationRescheduled");
      subject = t("subject");
      /*
       * L'hora nova, i l'antiga al costat: qui té al cap «dimarts a les 10»
       * ha de veure que és AQUELLA la que ha canviat. Si és d'una sèrie, es
       * diu que només es mou aquesta, perquè no pensi que ha canviat tota.
       */
      const oldWhen = d.oldWhenIso ? i.dateTime(d.oldWhenIso) : undefined;
      const s = sessionParts(i, d, contact);
      block = {
        eyebrow: { tone: "attention", text: t("eyebrow") },
        heading: t("heading"),
        preheader: s.preheader,
        intro: [hola, t("intro")],
        // L'hora gran és la NOVA; l'antiga, la primera fila, perquè es vegi
        // quina és la que ha canviat.
        hero: s.hero && { ...s.hero, plain: `${tl("newWhen")}: ${when}` },
        details: [...rows([[tl("oldWhen"), oldWhen]]), ...s.rows],
        notices: d.series === "1" ? [{ tone: "attention", text: t("series") }] : undefined,
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "session_reminder": {
      const t = i.ns("emails.sessionReminder");
      const s = sessionParts(i, d, contact);
      subject = t("subject");
      block = {
        eyebrow: { tone: "attention", text: t("eyebrow") },
        heading: t("heading"),
        preheader: s.preheader,
        intro: [hola, t("intro")],
        hero: s.hero,
        details: s.rows,
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        // Cancel·lar amb temps allibera la plaça: és un consell que compta.
        outro: [{ tone: "attention", text: t("outro") }],
        footer: "client",
      };
      break;
    }
    case "trial_request": {
      subject = "Nova sol·licitud de sessió de prova · VindiBCN";
      block = {
        heading: "Nova sol·licitud de prova",
        intro: [
          hola,
          "Un visitant ha demanat una sessió de prova gratuïta. Cal confirmar-la o rebutjar-la:",
        ],
        details: rows([
          ["Nom", d.visitorName],
          ["Data i hora", when],
          ["Telèfon", d.phone],
          ["Correu", d.email],
        ]),
        cta: { label: "Gestionar la sol·licitud", url: appLink("/trainer/reservas") },
        outro: [
          "Recorda que la sol·licitud pre-bloqueja el forat fins que caduca; confirma-la o rebutja-la com abans millor.",
        ],
        footer: "trainer",
      };
      break;
    }
    case "trial_status": {
      const confirmed = d.status === "confirmed";
      subject = confirmed
        ? "La teva sessió de prova està confirmada · VindiBCN"
        : "Sobre la teva sessió de prova · VindiBCN";
      block = confirmed
        ? {
            heading: "Sessió de prova confirmada!",
            intro: [
              hola,
              "Bones notícies: hem confirmat la teva sessió de prova gratuïta.",
            ],
            details: rows([["Data i hora", when]]),
            outro: [
              canReply(contact)
                ? "T'hi esperem! Arriba uns minuts abans amb roba còmoda. Si tens qualsevol dubte, respon a aquest correu."
                : "T'hi esperem! Arriba uns minuts abans amb roba còmoda.",
            ],
            footer: "visitor",
          }
        : {
            heading: "Sobre la teva sessió de prova",
            intro: [
              hola,
              "Ho sentim, però no hem pogut confirmar la teva sessió de prova per a la data sol·licitada.",
            ],
            cta: { label: "Demanar una altra data", url: appLink("/prova") },
            outro: ["Pots triar una altra franja quan vulguis. Ens encantaria conèixer-te!"],
            footer: "visitor",
          };
      break;
    }
    case "bono_low": {
      const t = i.ns("emails.bonoLow");
      // El llindar el tria l'admin: el número ha de viatjar fins al text, que
      // abans duia un «1» escrit a mà i mentia amb qualsevol altre valor.
      const queden = Number(d.remaining ?? 1);
      subject = t("subject", { remaining: queden });
      block = {
        heading: t("heading"),
        intro: [hola, t("intro", { service: service ?? "", remaining: queden })],
        cta: { label: t("cta"), url: appLink("/client/bonos") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "bono_auto_renewed": {
      const t = i.ns("emails.bonoAutoRenewed");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [
          hola,
          t("intro", {
            service: service ?? "",
            package: d.packageName ?? "",
            sessions: d.sessions ?? "",
            price: d.price ?? "",
          }),
        ],
        details: rows([
          [tl("service"), service],
          [tl("sessions"), d.sessions],
        ]),
        // El que de debò ha de quedar clar: encara no està pagat. Va al cos i
        // no només a l'assumpte, que és el que es llegeix de passada.
        cta: { label: t("cta"), url: appLink("/client/bonos/meus") },
        outro: [t("warn"), t("outro")],
        footer: "client",
      };
      break;
    }
    case "bono_renewal_failed": {
      const t = i.ns("emails.bonoRenewalFailed");
      subject = t("subject", { service: service ?? "" });
      block = {
        heading: t("heading"),
        intro: [hola, t("intro", { service: service ?? "" })],
        cta: { label: t("cta"), url: appLink("/client/bonos") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "bono_expiring_soon": {
      const t = i.ns("emails.bonoExpiringSoon");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro", { date: expires ?? "" })],
        details: rows([
          [tl("service"), service],
          [tl("remaining"), d.remaining],
          [tl("expiresOn"), expires],
        ]),
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "bono_unpaid_cancelled": {
      const t = i.ns("emails.bonoUnpaidCancelled");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro1"), t("intro2")],
        details: rows([
          [tl("service"), service],
          [tl("cancelled"), d.cancelled],
        ]),
        cta: { label: t("cta"), url: appLink("/client/bonos") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "subscription_renewed": {
      const t = i.ns("emails.subscriptionRenewed");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        details: rows([
          [tl("service"), service],
          [tl("sessionsThisCycle"), d.sessions],
          // La data arriba en ISO i es formata AQUÍ, amb l'idioma de qui llegeix.
          // És el contracte de tot aquest fitxer (`when`, `expires`): una data
          // ja formatada pel cridant sortiria en català dins d'un correu en
          // castellà, que és exactament el que passava.
          [tl("validUntil"), d.untilIso ? i.date(d.untilIso) : undefined],
        ]),
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "subscription_payment_failed": {
      const t = i.ns("emails.subscriptionPaymentFailed");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro1"), t("intro2")],
        details: rows([
          [tl("service"), service],
          // L'import, igual: arriba en cru i es formata amb l'idioma del
          // destinatari. `formatEur` sense locale cau al català.
          [tl("perMonth"), d.amountEur ? formatEur(Number(d.amountEur), i.locale) : undefined],
        ]),
        cta: { label: t("cta"), url: appLink("/client/bonos/meus") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "subscription_cancelled": {
      const t = i.ns("emails.subscriptionCancelled");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        details: rows([[tl("service"), service]]),
        cta: { label: t("cta"), url: appLink("/client/bonos/meus") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "subscription_paused": {
      const t = i.ns("emails.subscriptionPaused");
      subject = t("subject");
      block = {
        heading: t("heading"),
        // Dos paràgrafs i no un: el primer treu la por ("no has de fer res") i
        // el segon explica que el temps no es perd, que és el que de debò
        // distingeix una congelació d'una baixa.
        intro: [hola, t("intro1"), t("intro2")],
        details: rows([
          [tl("service"), service],
          // Només si n'hi ha: una pausa indefinida no té data, i inventar-ne una
          // seria pitjor que no dir-ne res.
          [tl("resumesOn"), d.resumeOnIso ? i.date(d.resumeOnIso) : undefined],
        ]),
        cta: { label: t("cta"), url: appLink("/client/bonos/meus") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "subscription_resumed": {
      const t = i.ns("emails.subscriptionResumed");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        details: rows([
          [tl("service"), service],
          [tl("nextRenewal"), d.nextRenewalIso ? i.date(d.nextRenewalIso) : undefined],
        ]),
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "community": {
      const t = i.ns("emails.community");
      subject = `${d.title ? esc(d.title) + " · " : ""}${t("subject")}`;
      block = {
        heading: d.title?.trim() ? d.title.trim() : t("heading"),
        intro: [hola, (d.body ?? "").trim() || t("fallback")],
        cta: { label: t("cta"), url: appLink("/client/comunitat") },
        footer: "client",
      };
      break;
    }
    case "trainer_booking_received": {
      subject = "Nova reserva a la teva agenda · VindiBCN";
      block = {
        heading: "Un client t'ha reservat una sessió",
        intro: [hola, "Tens una nova reserva a la teva agenda:"],
        details: rows([
          ["Client", d.client],
          ["Data i hora", when],
          ["Servei", service],
        ]),
        cta: { label: "Veure la meva agenda", url: appLink("/trainer/reservas") },
        footer: "trainer",
      };
      break;
    }
    case "trainer_booking_cancelled": {
      subject = "Un client ha cancel·lat una sessió · VindiBCN";
      block = {
        heading: "S'ha alliberat un forat de la teva agenda",
        intro: [hola, "Un client ha cancel·lat aquesta sessió:"],
        details: rows([
          ["Client", d.client],
          ["Data i hora", when],
          ["Servei", service],
        ]),
        cta: { label: "Veure la meva agenda", url: appLink("/trainer/reservas") },
        footer: "trainer",
      };
      break;
    }
    case "new_client_registered": {
      subject = "Nou client registrat · VindiBCN";
      block = {
        heading: "Nou client registrat",
        intro: [hola, "S'ha donat d'alta un client nou pel seu compte:"],
        details: rows([
          ["Nom", d.client],
          ["Correu", d.clientEmail],
        ]),
        cta: { label: "Veure la fitxa del client", url: d.url ?? appLink("/admin/clients") },
        footer: "admin",
      };
      break;
    }
    case "new_exercises_assigned": {
      const t = i.ns("emails.newExercisesAssigned");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        cta: { label: t("cta"), url: appLink("/client/exercicis") },
        footer: "client",
      };
      break;
    }
    case "invoice_generated": {
      subject = "La teva factura ja està disponible · VindiBCN";
      block = {
        heading: "Ja tens la factura del període",
        intro: [
          hola,
          "L'administració ha tancat la teva liquidació i n'ha emès el document. El pots descarregar des de la teva àrea:",
        ],
        details: rows([
          ["Període", d.period],
          ["Total", d.total],
        ]),
        cta: { label: "Veure la meva factura", url: appLink("/trainer/factures") },
        outro: [
          "Document provisional: el format oficial final es confirmarà amb l'assessoria. Si hi veus res que no quadri, parla amb l'administració del centre.",
        ],
        footer: "trainer",
      };
      break;
    }
    case "trainer_daily_agenda": {
      subject = "La teva agenda de demà · VindiBCN";
      let sessions: { time: string; client: string; service: string }[] = [];
      try {
        sessions = JSON.parse(d.sessions ?? "[]");
      } catch {
        sessions = [];
      }
      block = {
        heading: "La teva agenda de demà",
        intro: [
          hola,
          sessions.length
            ? `Demà tens ${sessions.length} ${sessions.length === 1 ? "sessió" : "sessions"}:`
            : "Demà no tens cap sessió programada. Bon descans!",
        ],
        details: sessions.map((s) => ({
          label: s.time,
          value: `${s.client} · ${s.service}`,
        })),
        cta: { label: "Veure la meva agenda", url: appLink("/trainer/reservas") },
        footer: "trainer",
      };
      break;
    }
    case "support_ticket_created": {
      // L'assumpte porta la categoria i el títol perquè es pugui triar què
      // mirar primer des de la safata, sense obrir el correu.
      subject = `[Suport · ${d.category}] ${d.title} · VindiBCN`;
      block = {
        heading: "Nou tiquet de suport",
        intro: [
          `${d.reporter} ha obert un tiquet des de ${d.area}.`,
          // La descripció sencera va al cos i no només a l'app: així es pot
          // valorar la incidència des del mòbil sense haver d'entrar-hi.
          d.description,
        ],
        details: rows([
          ["Títol", d.title],
          ["Categoria", d.category],
          ["Qui ho reporta", d.reporter],
          ["Data", when],
        ]),
        cta: { label: "Veure els tiquets", url: appLink("/admin/suport") },
        footer: "plain",
      };
      break;
    }
    case "waitlist_fulfilled": {
      const t = i.ns("emails.waitlistFulfilled");
      const s = sessionParts(i, d, contact);
      subject = t("subject");
      block = {
        eyebrow: { tone: "success", text: `✓ ${t("eyebrow")}` },
        heading: t("heading"),
        preheader: s.preheader,
        intro: [hola, t("intro")],
        hero: s.hero,
        details: s.rows,
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "gift_voucher_redeemed": {
      const t = i.ns("emails.giftRedeemed");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [
          hola,
          d.recipient
            ? t("introNamed", { name: d.recipient })
            : t("introAnon"),
        ],
        details: rows([
          [tl("gift"), pkg],
          [tl("code"), d.code],
          [tl("date"), when],
        ]),
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "gift_voucher_gifted": {
      /*
       * Va a qui rep el regal, que pot no tenir compte al centre: el correu
       * ha de bastar-se sol. Porta el codi al cos i no com a adjunt.
       *
       * L'idioma és el de qui REGALA, no el de qui rep: de qui rep no en
       * sabem res —sovint ni tan sols és client—, i qui compra sí que ha
       * triat en quina llengua vol que arribi el seu regal.
       */
      const t = i.ns("emails.giftGifted");
      subject = t("subjectFrom", { buyer: d.buyer || t("anon") });
      block = {
        heading: d.recipient
          ? t("headingNamed", { name: d.recipient })
          : t("heading"),
        intro: [
          d.buyer ? t("introFrom", { buyer: d.buyer }) : t("introAnon"),
          ...(d.message ? [`"${d.message}"`] : []),
          t("keep"),
        ],
        details: rows([
          [tl("code"), d.code],
          [tl("gift"), pkg],
          [tl("validUntil"), expires],
        ]),
        cta: { label: t("cta"), url: appLink("/client/bonos") },
        outro: [t("outro")],
        footer: "plain",
      };
      break;
    }
    default: {
      /*
       * Un tipus nou sense cas.
       *
       * Fins ara el `switch` no en tenia, i `block` quedava sense assignar:
       * afegir un esdeveniment i oblidar-se de la plantilla petava en enviar,
       * dins del `try` de `notify()`, o sigui en silenci i sense correu.
       *
       * `never` fa que ara peti a la COMPILACIÓ, que és on s'ha de veure. I si
       * tot i així n'arribés un (dades velles d'una cua, per exemple), surt un
       * correu mínim però vàlid en comptes de cap.
       */
      const unknown: never = event.type;
      subject = `VindiBCN`;
      block = {
        heading: "VindiBCN",
        intro: [hola, "Tens un avís nou a la teva àrea."],
        cta: { label: "Entrar", url: appLink("/") },
        footer: "plain",
      };
      void unknown;
      break;
    }
  }

  return {
    subject,
    html: layout(block, i, contact),
    text: plain(block, i, contact),
    replyTo: replyToFor(block, contact),
  };
}

/** Construeix files de detall, ometent les que no tinguin valor. */
function rows(pairs: [string, string | undefined][]): DetailRow[] {
  return pairs
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([label, value]) => ({ label, value: String(value) }));
}
