"use client";

import { SubmitButton } from "@/components/ui/submit-button";
import { downloadInvoiceAdminAction } from "@/app/(admin)/admin/facturacio/actions";
import { downloadInvoiceAction } from "@/app/(trainer)/trainer/factures/actions";

/**
 * Descàrrega del PDF d'una factura.
 *
 * L'enllaç no es pot posar directament al HTML: el bucket és privat i la
 * signed URL caduca en minuts, així que es demana en el moment del clic i el
 * servidor hi redirigeix després de comprovar qui la demana. Per això és un
 * formulari i no un `<a>`.
 *
 * `scope` decideix quina comprovació s'aplica: l'admin pot baixar la de
 * qualsevol professional; el professional, només les seves.
 */
export function DownloadInvoiceButton({
  settlementId,
  scope,
}: {
  settlementId: string;
  scope: "admin" | "trainer";
}) {
  const action =
    scope === "admin" ? downloadInvoiceAdminAction : downloadInvoiceAction;

  return (
    <form action={action}>
      <input type="hidden" name="settlementId" value={settlementId} />
      <SubmitButton
        pendingLabel="Preparant…"
        variant="outline"
        className="px-3 py-1.5 text-xs"
      >
        Descarregar
      </SubmitButton>
    </form>
  );
}
