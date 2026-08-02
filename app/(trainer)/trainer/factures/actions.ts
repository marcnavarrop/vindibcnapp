"use server";

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getSettlement } from "@/lib/data/settlements";
import { invoiceSignedUrl } from "@/lib/data/settlement-invoices";

/**
 * Descàrrega de la factura pel professional.
 *
 * La comprovació de propietat es fa aquí i no es delega a la RLS: `getSettlement`
 * ja llegeix amb el client de sessió (i la política només li deixa veure les
 * seves), però la signed URL es genera amb el client de servei, que se la
 * salta. Comparar `trainer_id` amb qui demana la descàrrega és el que impedeix
 * que un id endevinat serveixi la factura d'un company.
 */
export async function downloadInvoiceAction(fd: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") redirect("/login");

  const settlementId = String(fd.get("settlementId") ?? "");
  if (!settlementId) redirect("/trainer/factures");

  const settlement = await getSettlement(settlementId);
  if (
    !settlement ||
    settlement.trainerId !== viewer.id ||
    !settlement.invoicePath
  ) {
    redirect("/trainer/factures");
  }

  const url = await invoiceSignedUrl(settlement.invoicePath, {
    trainerName: viewer.fullName || "Professional",
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    lines: settlement.breakdown,
    total: settlement.totalAmount,
    generatedAt: settlement.generatedAt,
  });
  redirect(url);
}
