import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderGiftVoucherPdf,
  giftVoucherFileName,
  VOUCHER_MIME,
  type GiftVoucherPdfInput,
} from "@/lib/invoices/gift-voucher-pdf";

/**
 * El PDF del val al Storage. Mateix criteri que les factures de liquidació i
 * els documents del client: bucket PRIVAT sempre, i l'accés es dona amb una
 * signed URL de vida curta generada al servidor només després de comprovar qui
 * la demana.
 */
const BUCKET = "gift-vouchers";

/** Durada de l'enllaç de descàrrega (5 min: és un clic, no un enllaç a guardar). */
const SIGNED_URL_TTL = 300;

/**
 * Convenció de ruta: {buyer_client_id}/{voucher_id}.pdf
 *
 * El prefix és el comprador perquè la política de Storage pugui decidir amb
 * `split_part(name, '/', 1)` sense consultar cap taula.
 */
export function voucherStoragePath(buyerClientId: string, voucherId: string): string {
  return `${buyerClientId}/${voucherId}.pdf`;
}

/**
 * Genera el PDF i el puja. Torna la ruta desada.
 *
 * `upsert: true` a propòsit: si un intent anterior va deixar el fitxer pujat
 * però va fallar abans de desar la ruta, el reintent l'ha de poder trepitjar en
 * comptes de quedar-se bloquejat per un fitxer orfe.
 */
export async function uploadGiftVoucherPdf(opts: {
  buyerClientId: string;
  voucherId: string;
  content: GiftVoucherPdfInput;
}): Promise<string> {
  const path = voucherStoragePath(opts.buyerClientId, opts.voucherId);
  const bytes = await renderGiftVoucherPdf(opts.content);

  // En simulació no hi ha Storage: la ruta es desa igualment perquè la UI es
  // comporti igual, i el fitxer es torna a generar en descarregar-lo.
  if (USE_MOCK) return path;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: VOUCHER_MIME, upsert: true });
  if (error) throw new Error(`No s'ha pogut desar el val: ${error.message}`);
  return path;
}

/**
 * Enllaç de descàrrega. NO comprova permisos: qui crida ha d'haver verificat
 * abans que qui el demana pot veure aquest val.
 */
export async function giftVoucherSignedUrl(
  storagePath: string,
  content: GiftVoucherPdfInput,
): Promise<string> {
  if (USE_MOCK) {
    const bytes = await renderGiftVoucherPdf(content);
    return `data:${VOUCHER_MIME};base64,${Buffer.from(bytes).toString("base64")}`;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL, {
      download: giftVoucherFileName(content.code),
    });
  if (error || !data?.signedUrl)
    throw new Error("No s'ha pogut generar l'enllaç de descàrrega.");
  return data.signedUrl;
}

/** Esborra el fitxer (neteja de proves o d'una generació fallida). */
export async function deleteGiftVoucherPdf(storagePath: string): Promise<void> {
  if (USE_MOCK) return;
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([storagePath]);
}
