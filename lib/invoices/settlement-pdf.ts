import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { embedBrandLogo, logoWidthFor } from "@/lib/invoices/brand-logo";
import { BRAND, CENTER_NAME } from "@/lib/notifications/brand";
import { SERVICE_LABELS, formatEur, formatDate } from "@/lib/labels";
import type { SettlementBreakdownLine } from "@/types/database";

/**
 * Generació del PDF de la factura de liquidació.
 *
 * Per què pdf-lib i no HTML→PDF: generar PDF de debò a Vercel amb un navegador
 * headless (puppeteer) obliga a arrossegar un Chromium de centenars de MB que
 * no cap còmodament a una funció serverless i que s'espatlla cada cop que canvia
 * la versió del runtime. pdf-lib és JavaScript pur, sense binaris ni fonts
 * externes: escriu els bytes del PDF directament i funciona igual en local i a
 * producció. A canvi, la maquetació es fa a mà amb coordenades — per a un
 * document d'una pàgina com aquest, surt a compte.
 *
 * IMPORTANT: aquest document NO té validesa fiscal. Porta imprès l'avís de
 * provisionalitat; el format oficial l'ha de confirmar l'assessoria.
 */

/** El fitxer que veu l'usuari i la ruta al bucket comparteixen aquest nom. */
export const INVOICE_MIME = "application/pdf";

const AVIS_PROVISIONAL =
  "Document provisional. El format oficial final es confirmarà amb l'assessoria.";

// ─── Colors (pdf-lib treballa amb 0..1, la marca està en hex) ───────────────

function hex(color: string) {
  const n = parseInt(color.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const PURPLE = hex(BRAND.purple);
const ORANGE = hex(BRAND.orange);
const DARK = hex(BRAND.dark);
const CHARCOAL = hex(BRAND.charcoal);
const MUTED = hex(BRAND.muted);
const BORDER = hex(BRAND.border);
const BG = hex(BRAND.bg);
const WHITE = rgb(1, 1, 1);

// ─── Text ───────────────────────────────────────────────────────────────────

/**
 * Les fonts estàndard del PDF són WinAnsi: els accents catalans, el punt volat
 * i el símbol de l'euro hi caben, però un caràcter de fora (una cometa
 * tipogràfica enganxada des de Word, l'espai fi que hi posa Intl segons la
 * versió d'ICU) faria petar el dibuixat. Es normalitza tot abans d'escriure:
 * val més una substitució lletja que un PDF que no es genera.
 */
function winAnsi(input: string): string {
  return (input ?? "")
    .replace(/[\u00a0\u2007\u202f\u2009\u2060]/g, " ") // espais especials -> normal
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\u0020-\u00ff\u20ac]/g, "?");
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const RIGHT = A4.width - MARGIN;

type Ctx = {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
};

function drawText(
  ctx: Ctx,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
  },
) {
  ctx.page.drawText(winAnsi(text), {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.bold ? ctx.bold : ctx.regular,
    color: opts.color ?? CHARCOAL,
  });
}

/** Escriu alineat a la dreta de `right` (imports i quantitats de la taula). */
function drawRight(
  ctx: Ctx,
  text: string,
  opts: {
    right: number;
    y: number;
    size: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
  },
) {
  const safe = winAnsi(text);
  const font = opts.bold ? ctx.bold : ctx.regular;
  drawText(ctx, safe, {
    x: opts.right - font.widthOfTextAtSize(safe, opts.size),
    y: opts.y,
    size: opts.size,
    bold: opts.bold,
    color: opts.color,
  });
}

/** Parteix un text en línies que caben dins d'una amplada. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = winAnsi(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Document ───────────────────────────────────────────────────────────────

export type InvoiceInput = {
  trainerName: string;
  periodStart: string;
  periodEnd: string;
  lines: SettlementBreakdownLine[];
  total: number;
  /** Data d'emissió (ISO). Per defecte, ara. */
  generatedAt?: string;
  /** Referència curta a peu de document (id de la liquidació). */
  reference?: string;
};

export async function renderSettlementInvoicePdf(
  input: InvoiceInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Factura ${input.trainerName} ${input.periodStart} ${input.periodEnd}`);
  doc.setProducer(CENTER_NAME);
  doc.setCreator(CENTER_NAME);

  const page = doc.addPage([A4.width, A4.height]);
  const ctx: Ctx = {
    page,
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const generatedAt = input.generatedAt ?? new Date().toISOString();

  // ── Capçalera de marca ────────────────────────────────────────────────────
  const bandHeight = 96;
  page.drawRectangle({
    x: 0,
    y: A4.height - bandHeight,
    width: A4.width,
    height: bandHeight,
    color: PURPLE,
  });

  // El logotip de debò, el mateix que el val de regal i els correus. Abans
  // aquí hi havia "Vindi" + "BCN" escrit en Helvetica: era l'aproximació que
  // teníem quan encara no hi havia un fitxer únic de marca, i es notava al
  // costat de qualsevol altra pantalla. Si el fitxer no es pot llegir, es
  // torna a escriure el nom: una factura sense logo és millor que cap factura.
  const wordmarkY = A4.height - 52;
  const logo = await embedBrandLogo(doc);
  if (logo) {
    const h = 26;
    page.drawImage(logo, {
      x: MARGIN,
      y: wordmarkY - 4,
      width: logoWidthFor(logo, h),
      height: h,
    });
  } else {
    drawText(ctx, "Vindi", { x: MARGIN, y: wordmarkY, size: 24, bold: true, color: WHITE });
    drawText(ctx, "BCN", {
      x: MARGIN + ctx.bold.widthOfTextAtSize("Vindi", 24),
      y: wordmarkY,
      size: 24,
      bold: true,
      color: ORANGE,
    });
  }
  drawText(ctx, "Centre d'entrenament personal i fisioteràpia", {
    x: MARGIN,
    y: wordmarkY - 18,
    size: 9,
    color: WHITE,
  });
  drawRight(ctx, "FACTURA", {
    right: RIGHT,
    y: wordmarkY + 4,
    size: 14,
    bold: true,
    color: WHITE,
  });
  drawRight(ctx, `Emesa el ${formatDate(generatedAt)}`, {
    right: RIGHT,
    y: wordmarkY - 14,
    size: 9,
    color: WHITE,
  });

  let y = A4.height - bandHeight - 40;

  // ── Dades de la liquidació ────────────────────────────────────────────────
  const meta: [string, string][] = [
    ["Professional", input.trainerName],
    ["Període", `${formatDate(input.periodStart)} - ${formatDate(input.periodEnd)}`],
  ];
  for (const [label, value] of meta) {
    drawText(ctx, label.toUpperCase(), { x: MARGIN, y, size: 8, bold: true, color: MUTED });
    drawText(ctx, value, { x: MARGIN, y: y - 16, size: 14, bold: true, color: DARK });
    y -= 42;
  }

  y -= 6;

  // ── Taula de detall ───────────────────────────────────────────────────────
  const COL_SESSIONS = MARGIN + 300;
  const COL_RATE = MARGIN + 400;

  drawText(ctx, "Detall de sessions completades", {
    x: MARGIN,
    y,
    size: 11,
    bold: true,
    color: DARK,
  });
  y -= 22;

  // Capçalera
  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: RIGHT - MARGIN,
    height: 22,
    color: BG,
  });
  drawText(ctx, "SERVEI", { x: MARGIN + 10, y, size: 8, bold: true, color: MUTED });
  drawRight(ctx, "SESSIONS", { right: COL_SESSIONS, y, size: 8, bold: true, color: MUTED });
  drawRight(ctx, "TARIFA", { right: COL_RATE, y, size: 8, bold: true, color: MUTED });
  drawRight(ctx, "SUBTOTAL", { right: RIGHT - 10, y, size: 8, bold: true, color: MUTED });
  y -= 24;

  let hasMixedRates = false;
  for (const line of input.lines) {
    drawText(ctx, SERVICE_LABELS[line.serviceType] ?? line.serviceType, {
      x: MARGIN + 10,
      y,
      size: 11,
      color: CHARCOAL,
    });
    drawRight(ctx, String(line.sessions), { right: COL_SESSIONS, y, size: 11, color: CHARCOAL });
    if (line.rate !== null) {
      drawRight(ctx, formatEur(line.rate), { right: COL_RATE, y, size: 11, color: CHARCOAL });
    } else {
      hasMixedRates = true;
      drawRight(ctx, "diverses *", { right: COL_RATE, y, size: 10, color: MUTED });
    }
    drawRight(ctx, formatEur(line.amount), {
      right: RIGHT - 10,
      y,
      size: 11,
      bold: true,
      color: DARK,
    });

    y -= 12;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.5,
      color: BORDER,
    });
    y -= 18;
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  y -= 4;
  drawText(ctx, "TOTAL", { x: MARGIN + 10, y: y + 2, size: 10, bold: true, color: MUTED });
  drawRight(ctx, formatEur(input.total), {
    right: RIGHT - 10,
    y,
    size: 20,
    bold: true,
    color: PURPLE,
  });
  y -= 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: RIGHT, y },
    thickness: 1.5,
    color: PURPLE,
  });
  y -= 26;

  if (hasMixedRates) {
    drawText(
      ctx,
      "* La tarifa d'aquest servei va canviar dins del període: cada sessió s'ha valorat amb la vigent el seu dia.",
      { x: MARGIN, y, size: 8, color: MUTED },
    );
    y -= 20;
  }

  // ── Avís de provisionalitat ───────────────────────────────────────────────
  const noticeLines = wrap(AVIS_PROVISIONAL, ctx.bold, 10, RIGHT - MARGIN - 44);
  const extra = wrap(
    "Aquest document és un càlcul intern del centre sobre les sessions completades del període. No té validesa fiscal ni substitueix cap nòmina ni cap factura d'autònom.",
    ctx.regular,
    9,
    RIGHT - MARGIN - 44,
  );
  const noticeHeight = 26 + noticeLines.length * 13 + extra.length * 12;

  page.drawRectangle({
    x: MARGIN,
    y: y - noticeHeight + 12,
    width: RIGHT - MARGIN,
    height: noticeHeight,
    color: rgb(1, 0.96, 0.92),
    borderColor: ORANGE,
    borderWidth: 1,
  });

  let ny = y - 6;
  for (const l of noticeLines) {
    drawText(ctx, l, { x: MARGIN + 16, y: ny, size: 10, bold: true, color: ORANGE });
    ny -= 13;
  }
  ny -= 3;
  for (const l of extra) {
    drawText(ctx, l, { x: MARGIN + 16, y: ny, size: 9, color: CHARCOAL });
    ny -= 12;
  }

  // ── Peu ───────────────────────────────────────────────────────────────────
  drawText(ctx, `${CENTER_NAME} - document generat automàticament`, {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    color: MUTED,
  });
  if (input.reference) {
    drawRight(ctx, `Ref. ${input.reference}`, {
      right: RIGHT,
      y: MARGIN,
      size: 8,
      color: MUTED,
    });
  }

  return doc.save();
}

/** Nom que veurà qui la descarrega. */
export function invoiceFileName(input: {
  trainerName: string;
  periodStart: string;
  periodEnd: string;
}): string {
  const slug = winAnsi(input.trainerName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `factura-${slug || "professional"}-${input.periodStart}_${input.periodEnd}.pdf`;
}
