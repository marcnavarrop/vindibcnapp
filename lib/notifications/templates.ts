import "server-only";
import type { NotificationEvent } from "@/lib/notifications/types";
import { BRAND, CENTER_NAME, appLink, emailLogoUrl } from "@/lib/notifications/brand";

/** Escapa text per evitar injecció d'HTML des de dades d'usuari. */
function esc(s: string): string {
  return (s ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

type DetailRow = { label: string; value: string };
type Cta = { label: string; url: string };
type FooterKind = "client" | "trainer" | "visitor";

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

function footer(kind: FooterKind): string {
  const privacy = appLink("/legal/privacitat");
  let prefsLine = "";
  if (kind === "client")
    prefsLine = `Pots gestionar els teus avisos des de la teva àrea de client, a <a href="${appLink(
      "/client/configuracio",
    )}" style="color:${BRAND.purple};text-decoration:underline;">Configuració</a>.`;
  else if (kind === "trainer")
    prefsLine = `Pots gestionar els teus avisos des de la teva àrea, a <a href="${appLink(
      "/trainer/configuracio",
    )}" style="color:${BRAND.purple};text-decoration:underline;">Configuració</a>.`;
  else
    prefsLine = `Has rebut aquest correu perquè has demanat una sessió de prova a ${CENTER_NAME}.`;

  return `<tr><td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};">
    <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${BRAND.muted};">
      <strong style="color:${BRAND.charcoal};">${CENTER_NAME}</strong> · Centre d'entrenament personal i fisioteràpia
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
      ${prefsLine}
      &nbsp;·&nbsp;<a href="${privacy}" style="color:${BRAND.muted};text-decoration:underline;">Política de Privacitat</a>
    </p>
  </td></tr>`;
}

/** Capçalera de marca: icona del logo + wordmark "VindiBCN" (blanc/taronja). */
function brandHeader(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:middle;padding-right:10px;">
      <img src="${emailLogoUrl()}" width="34" height="34" alt="${CENTER_NAME}" style="display:block;width:34px;height:34px;border:0;outline:none;text-decoration:none;">
    </td>
    <td style="vertical-align:middle;">
      <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${BRAND.white};">Vindi<span style="color:${BRAND.orange};">BCN</span></span>
    </td>
  </tr></table>`;
}

function layout(block: Block): string {
  const bodyParts: string[] = [];
  bodyParts.push(
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${BRAND.dark};font-weight:800;">${esc(block.heading)}</h1>`,
  );
  for (const pgraph of block.intro) bodyParts.push(paragraph(pgraph));
  if (block.details && block.details.length) bodyParts.push(detailsTable(block.details));
  if (block.cta) bodyParts.push(ctaButton(block.cta));
  for (const pgraph of block.outro ?? []) bodyParts.push(paragraph(pgraph, BRAND.muted));

  return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="background:${BRAND.purple};padding:22px 32px;">
          ${brandHeader()}
        </td></tr>
        <tr><td style="padding:30px 32px 8px;">${bodyParts.join("")}</td></tr>
        ${footer(block.footer)}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Versió text pla a partir dels mateixos continguts (entregabilitat + fallback). */
function plain(block: Block): string {
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
  lines.push("", "—", `${CENTER_NAME} · Centre d'entrenament personal i fisioteràpia`);
  if (block.footer === "client")
    lines.push(`Gestiona els teus avisos: ${appLink("/client/configuracio")}`);
  else if (block.footer === "trainer")
    lines.push(`Gestiona els teus avisos: ${appLink("/trainer/configuracio")}`);
  lines.push(`Política de Privacitat: ${appLink("/legal/privacitat")}`);
  return lines.join("\n");
}

// ─────────────────────────── Plantilles per esdeveniment ───────────────────────────

export type RenderedEmail = { subject: string; html: string; text: string };

export function renderEmail(event: NotificationEvent): RenderedEmail {
  const d = event.data;
  const name = d.name?.trim() ? d.name.trim() : null;
  const hola = name ? `Hola ${name},` : "Hola,";

  let subject = "";
  let block: Block;

  switch (event.type) {
    case "reservation_confirmed": {
      subject = "Reserva confirmada · VindiBCN";
      block = {
        heading: "La teva reserva està confirmada",
        intro: [hola, "Hem registrat la teva sessió. Aquí tens els detalls:"],
        details: rows([
          ["Data i hora", d.when],
          ["Servei", d.service],
          ["Professional", d.trainer],
        ]),
        cta: { label: "Veure la meva reserva", url: appLink("/client/reservas") },
        outro: ["Ens veiem aviat! Si necessites canviar-la, pots fer-ho des de la teva àrea."],
        footer: "client",
      };
      break;
    }
    case "reservation_cancelled": {
      subject = "Reserva cancel·lada · VindiBCN";
      block = {
        heading: "S'ha cancel·lat una reserva",
        intro: [hola, "T'informem que aquesta sessió ha quedat anul·lada:"],
        details: rows([
          ["Data i hora", d.when],
          ["Servei", d.service],
        ]),
        cta: { label: "Reservar una altra sessió", url: appLink("/client/reservas") },
        outro: ["Si ha estat un error, contacta amb el centre o torna a reservar quan vulguis."],
        footer: "client",
      };
      break;
    }
    case "session_reminder": {
      subject = "Recordatori: tens sessió demà · VindiBCN";
      block = {
        heading: "Tens una sessió demà",
        intro: [hola, "Et recordem la teva propera sessió:"],
        details: rows([
          ["Data i hora", d.when],
          ["Servei", d.service],
          ["Professional", d.trainer],
        ]),
        cta: { label: "Veure la meva reserva", url: appLink("/client/reservas") },
        outro: [
          "Si no hi pots assistir, cancel·la-la com abans millor des de la teva àrea perquè una altra persona la pugui aprofitar.",
        ],
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
          ["Data i hora", d.when],
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
            details: rows([["Data i hora", d.when]]),
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
      subject = "Et queda 1 sessió al bo · VindiBCN";
      block = {
        heading: "El teu bo s'està acabant",
        intro: [
          hola,
          `Et queda només 1 sessió al teu bo de ${d.service ?? ""}.`,
        ],
        cta: { label: "Renovar el meu bo", url: appLink("/client/bonos/comprar") },
        outro: ["Renova'l quan vulguis per no quedar-te sense sessions."],
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
  }

  return { subject, html: layout(block), text: plain(block) };
}

/** Construeix files de detall, ometent les que no tinguin valor. */
function rows(pairs: [string, string | undefined][]): DetailRow[] {
  return pairs
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([label, value]) => ({ label, value: String(value) }));
}
