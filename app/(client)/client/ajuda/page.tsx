import { getCenterSettings } from "@/lib/data/center-settings";
import { stripeEnabled } from "@/lib/stripe";
import { GROUP_CAPACITY } from "@/lib/labels";
import { DOCUMENT_MAX_MB } from "@/lib/documents";
import {
  TRIAL_MIN_ADVANCE_HOURS,
  TRIAL_MAX_ADVANCE_DAYS,
} from "@/lib/data/trial-bookings.constants";
import { buildClientManual } from "@/lib/help/client-manual";
import { HelpManual } from "@/components/client/help-manual";
import { PrintManualButton } from "@/components/client/print-manual-button";

export const dynamic = "force-dynamic";

/**
 * El manual del client.
 *
 * ÉS L'ÚNICA PANTALLA DE L'ÀREA DE CLIENT QUE NO ES TRADUEIX, i és una decisió
 * conscient: el manual s'escriu en català i es validarà el format amb els tres
 * (client, professional, administració) abans de decidir si es tradueix. Ficar
 * un document d'aquesta llargada al diccionari abans d'aquella decisió hauria
 * volgut dir mantenir-lo per triplicat des del primer dia. L'entrada del menú
 * sí que va traduïda, com la resta.
 *
 * ELS NÚMEROS I ELS CAPÍTOLS SURTEN DE LA CONFIGURACIÓ DE DEBÒ
 *
 * Les hores de cancel·lació, l'aforament, el descompte de referits o els mesos
 * de caducitat es llegeixen aquí i s'escriuen al text; i els capítols dels
 * mòduls apagats no es generen. Un manual que parla d'una funció que el centre
 * té tancada menteix cada dia i ningú se n'assabenta fins que un client hi va a
 * buscar-la.
 */
export default async function ClientAjudaPage() {
  const settings = await getCenterSettings();

  const chapters = buildClientManual({
    minCancellationHours: settings.minCancellationHours,
    minBookingHours: settings.minBookingHours,
    openingHour: settings.openingHour,
    closingHour: settings.closingHour,
    groupCapacity: GROUP_CAPACITY,
    bonoLowThreshold: settings.bonoLowThreshold,
    bonoExpiryMonths: settings.bonoExpiryMonths,
    pendingPaymentCancelEnabled: settings.pendingPaymentCancelEnabled,
    pendingPaymentCancelHours: settings.pendingPaymentCancelHours,
    reminderHourLocal: settings.reminderHourLocal,
    giftVouchersEnabled: settings.giftVouchersEnabled,
    giftVoucherExpiryMonths: settings.giftVoucherExpiryMonths,
    waitlistEnabled: settings.waitlistEnabled,
    subscriptionsEnabled: settings.subscriptionsEnabled,
    subscriptionExtraSessionsMax: settings.subscriptionExtraSessionsMax,
    referralProgramActive: settings.referralProgramActive,
    referralDiscountPercent: settings.referralDiscountPercent,
    referralRewardReferee: settings.referralRewardReferee,
    modules: settings.modules,
    cardPayments: stripeEnabled(),
    documentsMaxMb: DOCUMENT_MAX_MB,
    trialMinAdvanceHours: TRIAL_MIN_ADVANCE_HOURS,
    trialMaxAdvanceDays: TRIAL_MAX_ADVANCE_DAYS,
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-brand-dark">Ajuda</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Com funciona la teva àrea de client, secció per secció.
          </p>
        </div>
        <PrintManualButton label="Descarregar PDF" />
      </div>

      <HelpManual chapters={chapters} />
    </main>
  );
}
