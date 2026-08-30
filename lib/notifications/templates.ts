import "server-only";
import type {
  NotificationEvent,
  NotificationEventType,
} from "@/lib/notifications/types";
import { emailI18n, type EmailI18n } from "@/lib/notifications/i18n";
import type { Locale } from "@/lib/i18n/config";
import {
  BRAND,
  CENTER_NAME,
  appLink,
  emailLogoUrl,
  EMAIL_LOGO_SIZE,
} from "@/lib/notifications/brand";

/** Escapa text per evitar injecció d'HTML des de dades d'usuari. */
function esc(s: string): string {
  return (s ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

type DetailRow = { label: string; value: string };
type Cta = { label: string; url: string };
type FooterKind = "client" | "trainer" | "admin" | "visitor" | "plain";

type Block = {
  heading: string;
  intro: string[]; // paràgrafs (text ja escapat o segur)
  details?: DetailRow[];
  cta?: Cta;
  outro?: string[];
  footer: FooterKind;
};

// ─────────────────────────── Layout (taules, inline) ───────────────────────────

function paragraph(text: string, color: string = BRAND.charcoal): string {
  // intro/outro són text pla: s'escapen aquí i es respecten els salts de línia.
  const safe = esc(text).replace(/\n/g, "<br>");
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${color};">${safe}</p>`;
}

function detailsTable(rows: DetailRow[]): string {
  const trs = rows
    .map(
      (r) => `<tr>
        <td style="padding:7px 0;font-size:13px;color:${BRAND.muted};white-space:nowrap;">${esc(r.label)}</td>
        <td style="padding:7px 0 7px 16px;font-size:15px;font-weight:700;color:${BRAND.dark};text-align:right;">${esc(r.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;margin:4px 0 20px;">
    <tr><td style="padding:6px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${trs}</table>
    </td></tr>
  </table>`;
}

function ctaButton(cta: Cta): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">
    <tr><td style="border-radius:10px;background:${BRAND.purple};">
      <a href="${cta.url}" target="_blank" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:10px;">${esc(cta.label)}</a>
    </td></tr>
  </table>`;
}

function footer(kind: FooterKind, i: EmailI18n): string {
  const f = i.ns("emails.footer");
  const privacy = appLink("/legal/privacitat");
  let prefsLine = "";
  if (kind === "client") {
    const link = `<a href="${appLink("/client/configuracio")}" style="color:${BRAND.purple};text-decoration:underline;">${f("settings")}</a>`;
    prefsLine = f("clientPrefs", { link });
  } else if (kind === "trainer")
    prefsLine = `Pots gestionar els teus avisos des de la teva àrea, a <a href="${appLink(
      "/trainer/configuracio",
    )}" style="color:${BRAND.purple};text-decoration:underline;">Configuració</a>.`;
  else if (kind === "admin")
    prefsLine = `Pots gestionar els teus avisos a <a href="${appLink(
      "/admin/configuracio",
    )}" style="color:${BRAND.purple};text-decoration:underline;">Configuració</a>.`;
  else if (kind === "visitor")
    prefsLine = `Has rebut aquest correu perquè has demanat una sessió de prova a ${CENTER_NAME}.`;
  // "plain": només marca + privacitat (emails de compte: invitació/recuperació).

  return `<tr><td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};">
    <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${BRAND.muted};">
      <strong style="color:${BRAND.charcoal};">${CENTER_NAME}</strong> · ${f("tagline")}
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
      ${prefsLine ? `${prefsLine}&nbsp;·&nbsp;` : ""}<a href="${privacy}" style="color:${BRAND.muted};text-decoration:underline;">${f("privacy")}</a>
    </p>
  </td></tr>`;
}

/**
 * Capçalera de marca: el logotip oficial, el mateix fitxer que la resta de
 * l'app, damunt del lila.
 *
 * Abans eren dues coses —l'isotip petit i el nom escrit al costat en HTML— i
 * el correu era l'últim lloc on la marca es veia diferent. Ara el nom ja va
 * dins de la imatge, així que el text del costat sobrava.
 *
 * L'`alt` porta estil propi perquè, quan un client bloqueja les imatges (i
 * Outlook i Gmail ho fan per defecte amb remitents desconeguts), el que quedi
 * sigui "VindiBCN" en blanc i gros damunt del lila, no el text diminut i
 * negre per defecte.
 */
function brandHeader(): string {
  const { width, height } = EMAIL_LOGO_SIZE;
  return `<img src="${emailLogoUrl()}" width="${width}" height="${height}" alt="${CENTER_NAME}" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;font-size:16px;font-weight:800;letter-spacing:-0.3px;color:${BRAND.white};">`;
}

function layout(block: Block, i: EmailI18n): string {
  const bodyParts: string[] = [];
  bodyParts.push(
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${BRAND.dark};font-weight:800;">${esc(block.heading)}</h1>`,
  );
  for (const pgraph of block.intro) bodyParts.push(paragraph(pgraph));
  if (block.details && block.details.length) bodyParts.push(detailsTable(block.details));
  if (block.cta) bodyParts.push(ctaButton(block.cta));
  for (const pgraph of block.outro ?? []) bodyParts.push(paragraph(pgraph, BRAND.muted));

  return `<!doctype html>
<html lang="${i.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>:root{color-scheme:light only;supported-color-schemes:light only;}</style></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="background:${BRAND.purple};padding:22px 32px;">
          ${brandHeader()}
        </td></tr>
        <tr><td style="padding:30px 32px 8px;">${bodyParts.join("")}</td></tr>
        ${footer(block.footer, i)}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Versió text pla a partir dels mateixos continguts (entregabilitat + fallback). */
function plain(block: Block, i: EmailI18n): string {
  const lines: string[] = [block.heading, ""];
  lines.push(...block.intro);
  if (block.details && block.details.length) {
    lines.push("");
    for (const r of block.details) lines.push(`${r.label}: ${r.value}`);
  }
  if (block.cta) {
    lines.push("");
    lines.push(`${block.cta.label}: ${block.cta.url}`);
  }
  if (block.outro && block.outro.length) {
    lines.push("");
    lines.push(...block.outro);
  }
  const f = i.ns("emails.footer");
  lines.push("", "—", `${CENTER_NAME} · ${f("tagline")}`);
  if (block.footer === "client")
    lines.push(f("managePlain", { url: appLink("/client/configuracio") }));
  else if (block.footer === "trainer")
    lines.push(`Gestiona els teus avisos: ${appLink("/trainer/configuracio")}`);
  lines.push(f("privacyPlain", { url: appLink("/legal/privacitat") }));
  return lines.join("\n");
}

// ─────────────────────────── Plantilles per esdeveniment ───────────────────────────

export type RenderedEmail = { subject: string; html: string; text: string };

/** Email d'invitació (crear contrasenya) amb la marca. */
export function renderInviteEmail(input: {
  name: string | null;
  url: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
}): RenderedEmail {
  const i = emailI18n(input.locale);
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
    html: layout(block, i),
    text: plain(block, i),
  };
}

/** Email de restabliment de contrasenya amb la marca. */
export function renderRecoveryEmail(input: {
  name: string | null;
  url: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
}): RenderedEmail {
  const i = emailI18n(input.locale);
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
    html: layout(block, i),
    text: plain(block, i),
  };
}

/** Email de benvinguda per a un client que s'ha registrat pel seu compte. */
export function renderWelcomeEmail(input: {
  name: string | null;
  url: string;
  /** Idioma de qui el rep. Sense res, català. */
  locale?: Locale | null;
}): RenderedEmail {
  const i = emailI18n(input.locale);
  const hola = input.name?.trim() ? `Hola ${input.name.trim()},` : "Hola,";
  const block: Block = {
    heading: "Benvingut/da a VindiBCN!",
    intro: [
      hola,
      "Ens alegra molt tenir-te amb nosaltres. Des de la teva àrea podràs reservar sessions, comprar bons i consultar els teus exercicis.",
    ],
    cta: { label: "Entra a la teva àrea", url: input.url },
    outro: ["Qualsevol dubte, respon a aquest correu o parla amb el centre. Ens veiem aviat!"],
    footer: "client",
  };
  return {
    subject: "Benvingut/da a VindiBCN!",
    html: layout(block, i),
    text: plain(block, i),
  };
}

/**
 * Les plantilles que ja estan traduïdes.
 *
 * Substitueix l'interruptor global del bloc 1, que era una mentida còmoda:
 * deia "cap correu està traduït" quan la veritat és per plantilla. Les que no
 * hi són s'escriuen en CATALÀ encara que qui les rebi tingui un altre idioma
 * triat —i, sobretot, també les seves dates—, perquè un correu amb el text en
 * català i les dates en castellà és pitjor que un correu tot en català.
 *
 * El bloc 3 hi afegeix les que falten i llavors aquesta llista sobra: si hi
 * són totes, es pot esborrar i passar l'idioma sempre.
 */
const TRANSLATED: ReadonlySet<NotificationEventType> = new Set([
  "reservation_confirmed",
  "reservation_cancelled",
  "session_reminder",
  "bono_low",
  "bono_expiring_soon",
  "bono_unpaid_cancelled",
  "waitlist_fulfilled",
]);

export function renderEmail(event: NotificationEvent): RenderedEmail {
  // L'idioma surt del DESTINATARI, no de qui envia. Un mateix esdeveniment
  // —les novetats de la comunitat— arriba a clients i professionals dins del
  // mateix bucle, i cadascú l'ha de rebre en el seu.
  const i = emailI18n(
    TRANSLATED.has(event.type) ? event.recipient.locale : null,
  );
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

  let subject = "";
  let block: Block;

  switch (event.type) {
    case "reservation_confirmed": {
      const t = i.ns("emails.reservationConfirmed");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        details: rows([
          [tl("when"), when],
          [tl("service"), service],
          [tl("trainer"), d.trainer],
        ]),
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "reservation_cancelled": {
      const t = i.ns("emails.reservationCancelled");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        details: rows([
          [tl("when"), when],
          [tl("service"), service],
        ]),
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "session_reminder": {
      const t = i.ns("emails.sessionReminder");
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        details: rows([
          [tl("when"), when],
          [tl("service"), service],
          [tl("trainer"), d.trainer],
        ]),
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
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
              "T'hi esperem! Arriba uns minuts abans amb roba còmoda. Si tens qualsevol dubte, respon a aquest correu.",
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
      subject = t("subject");
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
    case "community": {
      subject = `${d.title ? esc(d.title) + " · " : ""}Novetats de VindiBCN`;
      block = {
        heading: d.title?.trim() ? d.title.trim() : "Novetats del centre",
        intro: [hola, (d.body ?? "").trim() || "Tenim novetats per compartir amb tu."],
        cta: { label: "Veure-ho a la comunitat", url: appLink("/client/comunitat") },
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
      subject = "Nous exercicis assignats · VindiBCN";
      block = {
        heading: "Tens exercicis nous assignats!",
        intro: [
          hola,
          "El teu professional t'ha afegit exercicis nous. Consulta'ls a la teva àrea per veure les instruccions i els vídeos.",
        ],
        cta: { label: "Veure els meus exercicis", url: appLink("/client/exercicis") },
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
      subject = t("subject");
      block = {
        heading: t("heading"),
        intro: [hola, t("intro")],
        details: rows([
          [tl("when"), when],
          [tl("service"), service],
          [tl("trainer"), d.trainer],
        ]),
        cta: { label: t("cta"), url: appLink("/client/reservas") },
        outro: [t("outro")],
        footer: "client",
      };
      break;
    }
    case "gift_voucher_redeemed": {
      subject = "Ja han fet servir el teu regal · VindiBCN";
      block = {
        heading: "El teu regal ha arribat",
        intro: [
          hola,
          d.recipient
            ? `${d.recipient} ha bescanviat el val de regal que li vas comprar.`
            : "Algú ha bescanviat el val de regal que vas comprar.",
        ],
        details: rows([
          ["Regal", d.package],
          ["Codi", d.code],
          ["Data", when],
        ]),
        outro: ["Gràcies per regalar benestar. Ens veiem al centre!"],
        footer: "client",
      };
      break;
    }
    case "gift_voucher_gifted": {
      // Va a qui rep el regal, que pot no tenir compte al centre: el correu ha
      // de bastar-se sol. Porta el codi al cos i no com a adjunt, perquè un
      // adjunt es perd i un codi es pot escriure des del mòbil.
      subject = `Tens un regal de ${d.buyer || "algú"} · VindiBCN`;
      block = {
        heading: d.recipient ? `${d.recipient}, tens un regal!` : "Tens un regal!",
        intro: [
          d.buyer
            ? `${d.buyer} t'ha regalat sessions a VindiBCN.`
            : "T'han regalat sessions a VindiBCN.",
          ...(d.message ? [`"${d.message}"`] : []),
          "Aquest és el teu codi. Guarda'l: és el que hauràs d'escriure per activar-lo.",
        ],
        details: rows([
          ["Codi", d.code],
          ["Regal", d.package],
          ["Vàlid fins al", expires],
        ]),
        cta: { label: "Bescanviar el regal", url: appLink("/client/bonos") },
        outro: [
          "Entra a la teva àrea de client (o registra-t'hi si encara no en tens), ves a Bons i escriu el codi. Les sessions s'afegiran al teu compte.",
        ],
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

  return { subject, html: layout(block, i), text: plain(block, i) };
}

/** Construeix files de detall, ometent les que no tinguin valor. */
function rows(pairs: [string, string | undefined][]): DetailRow[] {
  return pairs
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([label, value]) => ({ label, value: String(value) }));
}
