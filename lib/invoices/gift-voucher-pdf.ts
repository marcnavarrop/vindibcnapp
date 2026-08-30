import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { embedBrandLogo, logoWidthFor } from "@/lib/invoices/brand-logo";
import { BRAND, CENTER_NAME } from "@/lib/notifications/brand";
import { staticI18n } from "@/lib/i18n/no-request";
import { deOf, formatDate } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
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
  /**
   * Idioma del document: el de qui REGALA.
   *
   * Mateix criteri que el correu del val. Però aquí no surt de la cookie sinó
   * del perfil de qui compra, i és a posta: el PDF es genera també des del
   * webhook de Stripe, on no hi ha ni sessió ni cookies, i es pot tornar a
   * generar més tard —fins i tot des de la descàrrega d'un admin—. Havia de
   * ser una font que doni el mateix resultat des dels quatre camins.
   */
  locale?: Locale | null;
};

export async function renderGiftVoucherPdf(
  input: GiftVoucherPdfInput,
): Promise<Uint8Array> {
  const i = staticI18n(input.locale);
  const t = i.ns("voucherPdf");

  const doc = await PDFDocument.create();
  doc.setTitle(t("docTitle", { code: input.code, centre: CENTER_NAME }));
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
  drawText(ctx, t("tagline"), {
    x: MARGIN,
    y: PAGE.height - band + 22,
    size: 9,
    color: WHITE,
  });
  const banner = t("banner");
  drawText(ctx, banner, {
    x: RIGHT - widthOf(ctx, banner, 15, true),
    y: PAGE.height - band + 48,
    size: 15,
    bold: true,
    color: ORANGE,
  });

  let y = PAGE.height - band - 46;

  // ── Regal ─────────────────────────────────────────────────────────────────
  drawCentered(ctx, t("forYou"), {
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
    t("sessionsOf", {
      count: input.totalSessions,
      /*
       * En català la preposició s'apostrofa segons la paraula que ve
       * darrere: "d'EP Individual" però "de Grup reduït". Cap format ICU
       * ho sap fer, així que el català es prepara aquí i les altres dues
       * llengües porten la preposició al diccionari, on li toca.
       */
      service:
        i.locale === "ca"
          ? deOf(i.service(input.serviceType))
          : i.service(input.serviceType),
    }),
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
  drawCentered(ctx, t("yourCode"), { center, y: y + 2, size: 8, bold: true, color: MUTED });
  drawCentered(ctx, input.code, { center, y: y - 32, size: 27, bold: true, color: PURPLE });
  y -= boxH + 18;

  // ── De part de / Per a ────────────────────────────────────────────────────
  const parts: [string, string][] = [];
  if (input.buyerName) parts.push([t("from"), input.buyerName]);
  if (input.recipientName) parts.push([t("to"), input.recipientName]);
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

  drawText(ctx, t("howTo"), {
    x: MARGIN,
    y: footerTop - 20,
    size: 8,
    bold: true,
    color: MUTED,
  });
  const steps = [t("step1"), t("step2"), t("step3")];
  let sy = footerTop - 36;
  for (const step of steps) {
    drawText(ctx, step, { x: MARGIN, y: sy, size: 9.5, color: CHARCOAL });
    sy -= 14;
  }

  const validity = t("validUntil", {
    date: formatDate(input.expiresAt, i.locale),
  });
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

/** Nom del fitxer que veurà qui el descarrega, en el seu idioma. */
export function giftVoucherFileName(code: string, locale?: Locale | null): string {
  const t = staticI18n(locale).ns("voucherPdf");
  return `${t("fileName")}-${code.toLowerCase()}.pdf`;
}
