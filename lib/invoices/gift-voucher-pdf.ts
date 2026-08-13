import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { embedBrandLogo, logoWidthFor } from "@/lib/invoices/brand-logo";
import { BRAND, CENTER_NAME } from "@/lib/notifications/brand";
import { SERVICE_LABELS, deOf, formatDate } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

/**
 * El PDF del val de regal.
 *
 * Mateixa tecnologia que la factura de liquidació (pdf-lib, JavaScript pur,
 * sense Chromium ni fonts externes) i pels mateixos motius. Aquí, a més, hi ha
 * el logotip real incrustat: un val de regal s'imprimeix i es dona a algú, i el
 * text "VindiBCN" escrit amb Helvetica no és la marca.
 *
 * El document NO diu mai si està pagat o no. Qui el rep no ha de saber res dels
 * comptes entre el centre i qui l'ha comprat; si el val encara no s'ha cobrat,
 * qui se n'assabenta és qui el bescanvia, en el moment de fer-ho, amb un
 * missatge que li diu què fer.
 */

export const VOUCHER_MIME = "application/pdf";

function hex(color: string) {
  const n = parseInt(color.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const PURPLE = hex(BRAND.purple);
const PURPLE_LIGHT = hex(BRAND.purpleLight);
const ORANGE = hex(BRAND.orange);
const DARK = hex(BRAND.dark);
const CHARCOAL = hex(BRAND.charcoal);
const MUTED = hex(BRAND.muted);
const BORDER = hex(BRAND.border);
const WHITE = rgb(1, 1, 1);

/** Les fonts estàndard són WinAnsi: es neteja el que no hi cap. */
function winAnsi(input: string): string {
  return (input ?? "")
    .replace(/[\u00a0\u2007\u202f\u2009\u2060]/g, " ")
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\u0020-\u00ff\u20ac]/g, "?");
}

/** Apaïsat: un val de regal s'assembla més a una targeta que a un full. */
const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 52;
const RIGHT = PAGE.width - MARGIN;

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont };

function drawText(
  ctx: Ctx,
  text: string,
  o: { x: number; y: number; size: number; bold?: boolean; color?: ReturnType<typeof rgb> },
) {
  ctx.page.drawText(winAnsi(text), {
    x: o.x,
    y: o.y,
    size: o.size,
    font: o.bold ? ctx.bold : ctx.regular,
    color: o.color ?? CHARCOAL,
  });
}

function widthOf(ctx: Ctx, text: string, size: number, bold?: boolean) {
  return (bold ? ctx.bold : ctx.regular).widthOfTextAtSize(winAnsi(text), size);
}

function drawCentered(
  ctx: Ctx,
  text: string,
  o: { center: number; y: number; size: number; bold?: boolean; color?: ReturnType<typeof rgb> },
) {
  drawText(ctx, text, { ...o, x: o.center - widthOf(ctx, text, o.size, o.bold) / 2 });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of winAnsi(text).split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export type GiftVoucherPdfInput = {
  code: string;
  packageName: string;
  serviceType: ServiceType;
  totalSessions: number;
  expiresAt: string;
  buyerName: string | null;
  recipientName: string | null;
  message: string | null;
};

export async function renderGiftVoucherPdf(
  input: GiftVoucherPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Val de regal ${input.code} · ${CENTER_NAME}`);
  doc.setProducer(CENTER_NAME);
  doc.setCreator(CENTER_NAME);

  const page = doc.addPage([PAGE.width, PAGE.height]);
  const ctx: Ctx = {
    page,
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await embedBrandLogo(doc);
  const center = PAGE.width / 2;

  // ── Banda de marca ────────────────────────────────────────────────────────
  const band = 118;
  page.drawRectangle({
    x: 0,
    y: PAGE.height - band,
    width: PAGE.width,
    height: band,
    color: PURPLE,
  });
  // Un toc de color càlid a la cantonada, com a les targetes de l'app.
  page.drawCircle({
    x: PAGE.width - 40,
    y: PAGE.height - 30,
    size: 90,
    color: PURPLE_LIGHT,
    opacity: 0.35,
  });

  if (logo) {
    const h = 40;
    const w = logoWidthFor(logo, h);
    page.drawImage(logo, { x: MARGIN, y: PAGE.height - band + 40, width: w, height: h });
  } else {
    drawText(ctx, "Vindi", {
      x: MARGIN,
      y: PAGE.height - band + 46,
      size: 30,
      bold: true,
      color: WHITE,
    });
  }
  drawText(ctx, "Centre d'entrenament personal i fisioteràpia", {
    x: MARGIN,
    y: PAGE.height - band + 22,
    size: 9,
    color: WHITE,
  });
  drawText(ctx, "VAL DE REGAL", {
    x: RIGHT - widthOf(ctx, "VAL DE REGAL", 15, true),
    y: PAGE.height - band + 48,
    size: 15,
    bold: true,
    color: ORANGE,
  });

  let y = PAGE.height - band - 46;

  // ── Regal ─────────────────────────────────────────────────────────────────
  drawCentered(ctx, "AIXÒ ÉS UN REGAL PER A TU", {
    center,
    y,
    size: 9,
    bold: true,
    color: MUTED,
  });
  y -= 34;
  drawCentered(ctx, input.packageName, { center, y, size: 26, bold: true, color: DARK });
  y -= 22;
  drawCentered(
    ctx,
    `${input.totalSessions} ${input.totalSessions === 1 ? "sessió" : "sessions"} ${deOf(SERVICE_LABELS[input.serviceType])}`,
    { center, y, size: 13, color: CHARCOAL },
  );
  y -= 40;

  // ── El codi ───────────────────────────────────────────────────────────────
  // És el que de debò val: gros, centrat i dins d'una caixa que es veu de
  // lluny, perquè és el que s'haurà d'escriure a l'app.
  const boxW = 400;
  const boxH = 76;
  page.drawRectangle({
    x: center - boxW / 2,
    y: y - boxH + 22,
    width: boxW,
    height: boxH,
    color: WHITE,
    borderColor: PURPLE,
    borderWidth: 2,
  });
  drawCentered(ctx, "EL TEU CODI", { center, y: y + 2, size: 8, bold: true, color: MUTED });
  drawCentered(ctx, input.code, { center, y: y - 32, size: 27, bold: true, color: PURPLE });
  y -= boxH + 18;

  // ── De part de / Per a ────────────────────────────────────────────────────
  const parts: [string, string][] = [];
  if (input.buyerName) parts.push(["DE PART DE", input.buyerName]);
  if (input.recipientName) parts.push(["PER A", input.recipientName]);
  if (parts.length > 0) {
    const colW = (RIGHT - MARGIN) / parts.length;
    parts.forEach(([label, value], i) => {
      const x = MARGIN + colW * i + colW / 2;
      drawCentered(ctx, label, { center: x, y, size: 8, bold: true, color: MUTED });
      drawCentered(ctx, value, { center: x, y: y - 17, size: 13, bold: true, color: DARK });
    });
    y -= 44;
  }

  // ── Missatge personal ─────────────────────────────────────────────────────
  if (input.message) {
    const lines = wrap(`"${input.message}"`, ctx.regular, 11, RIGHT - MARGIN - 120).slice(0, 4);
    for (const line of lines) {
      drawCentered(ctx, line, { center, y, size: 11, color: CHARCOAL });
      y -= 16;
    }
    y -= 10;
  }

  // ── Com es bescanvia ──────────────────────────────────────────────────────
  const footerTop = MARGIN + 78;
  page.drawLine({
    start: { x: MARGIN, y: footerTop },
    end: { x: RIGHT, y: footerTop },
    thickness: 0.5,
    color: BORDER,
  });

  drawText(ctx, "COM EL FAIG SERVIR", {
    x: MARGIN,
    y: footerTop - 20,
    size: 8,
    bold: true,
    color: MUTED,
  });
  const steps = [
    "1. Entra a la teva àrea de client (o registra-t'hi si encara no en tens).",
    "2. Ves a Bons i escriu aquest codi a \"Tens un codi de regal?\".",
    "3. Les sessions s'afegeixen al teu compte i ja pots reservar.",
  ];
  let sy = footerTop - 36;
  for (const step of steps) {
    drawText(ctx, step, { x: MARGIN, y: sy, size: 9.5, color: CHARCOAL });
    sy -= 14;
  }

  const validity = `Vàlid fins al ${formatDate(input.expiresAt)}`;
  drawText(ctx, validity, {
    x: RIGHT - widthOf(ctx, validity, 11, true),
    y: footerTop - 24,
    size: 11,
    bold: true,
    color: ORANGE,
  });
  drawText(ctx, CENTER_NAME, {
    x: RIGHT - widthOf(ctx, CENTER_NAME, 9),
    y: footerTop - 42,
    size: 9,
    color: MUTED,
  });

  return doc.save();
}

/** Nom del fitxer que veurà qui el descarrega. */
export function giftVoucherFileName(code: string): string {
  return `val-regal-${code.toLowerCase()}.pdf`;
}
