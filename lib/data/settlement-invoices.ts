import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderSettlementInvoicePdf,
  invoiceFileName,
  INVOICE_MIME,
} from "@/lib/invoices/settlement-pdf";
import type { SettlementBreakdownLine } from "@/types/database";

/**
 * El PDF de la factura al Storage. Mateix criteri que client-documents: bucket
 * PRIVAT sempre, i l'accés es dona amb una signed URL de vida curta que es
 * genera al servidor només després de comprovar qui la demana.
 */
const BUCKET = "settlement-invoices";

/** Durada de l'enllaç de descàrrega (5 min: és un clic, no un enllaç a guardar). */
const SIGNED_URL_TTL = 300;

/**
 * Convenció de ruta: {trainer_id}/{settlement_id}.pdf
 *
 * El prefix és el professional perquè la política de Storage pugui decidir
 * amb `split_part(name, '/', 1)` sense consultar cap taula.
 */
export function invoiceStoragePath(trainerId: string, settlementId: string): string {
  return `${trainerId}/${settlementId}.pdf`;
}

export type InvoiceContent = {
  trainerName: string;
  periodStart: string;
  periodEnd: string;
  lines: SettlementBreakdownLine[];
  total: number;
  generatedAt?: string;
};

/**
 * Genera el PDF i el puja. Torna la ruta desada.
 *
 * `upsert: true` a propòsit: si un intent anterior va deixar el fitxer pujat
 * però va fallar abans de desar la ruta, el reintent l'ha de poder trepitjar en
 * comptes de quedar-se bloquejat per un fitxer orfe.
 */
export async function uploadSettlementInvoice(opts: {
  trainerId: string;
  settlementId: string;
  content: InvoiceContent;
}): Promise<string> {
  const path = invoiceStoragePath(opts.trainerId, opts.settlementId);

  const bytes = await renderSettlementInvoicePdf({
    ...opts.content,
    reference: opts.settlementId.slice(0, 8),
  });

  // En simulació no hi ha Storage: la ruta es desa igualment perquè la UI es
  // comporti igual, i el fitxer es torna a generar en el moment de descarregar.
  if (USE_MOCK) return path;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(bytes), {
      contentType: INVOICE_MIME,
      upsert: true,
    });
  if (error) throw new Error(`No s'ha pogut desar la factura: ${error.message}`);
  return path;
}

/**
 * Enllaç de descàrrega. NO comprova permisos: qui crida ha d'haver verificat
 * abans que el sol·licitant pot veure aquesta liquidació.
 */
export async function invoiceSignedUrl(
  storagePath: string,
  content: InvoiceContent,
): Promise<string> {
  const fileName = invoiceFileName(content);

  if (USE_MOCK) {
    const bytes = await renderSettlementInvoicePdf(content);
    return `data:${INVOICE_MIME};base64,${Buffer.from(bytes).toString("base64")}`;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL, { download: fileName });
  if (error || !data?.signedUrl)
    throw new Error("No s'ha pogut generar l'enllaç de descàrrega.");
  return data.signedUrl;
}

/** Esborra el fitxer (rollback d'una generació fallida, o neteja de proves). */
export async function deleteSettlementInvoice(storagePath: string): Promise<void> {
  if (USE_MOCK) return;
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([storagePath]);
}
