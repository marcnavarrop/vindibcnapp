import { getCenterSettings } from "@/lib/data/center-settings";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { GROUP_CAPACITY } from "@/lib/labels";
import { BONO_EXPIRY_WARNING_DAYS } from "@/lib/data/reminders";
import { stripeEnabled } from "@/lib/stripe";
import {
  TRIAL_MIN_ADVANCE_HOURS,
  TRIAL_MAX_ADVANCE_DAYS,
} from "@/lib/data/trial-bookings.constants";
import { buildAdminManual } from "@/lib/help/admin-manual";
import { HelpManual } from "@/components/client/help-manual";
import { PrintManualButton } from "@/components/client/print-manual-button";
import { BackToTop } from "@/components/client/back-to-top";

export const dynamic = "force-dynamic";

/**
 * El manual de l'administració. Tercer i últim dels tres.
 *
 * Mateixa peça que els altres dos: el contingut viu a `lib/help/admin-manual`
 * i aquí només s'hi aboquen els ajustos de debò. El component que el pinta
 * (`HelpManual`) és literalment el mateix des del primer; no sap res del
 * contingut, així que tampoc aquesta vegada ha calgut tocar-lo.
 *
 * Sense i18n, com la resta de l'àrea d'administració: aquesta àrea és en
 * català fix i el proveïdor d'idioma ni tan sols hi arriba.
 *
 * ELS NÚMEROS I ELS CAPÍTOLS SURTEN DE LA CONFIGURACIÓ
 *
 * Aquí la dependència és més forta que als altres dos manuals, perquè qui el
 * llegeix és qui pot canviar el que explica: l'horari, els marges de reserva i
 * cancel·lació, els llindars, els terminis, els interruptors de vals, llista
 * d'espera, subscripcions i referits, i els tres mòduls. Un manual que digués
 * "24 hores" mentre la configuració diu 48 seria una font d'errors, no d'ajuda.
 */
export default async function AdminAjudaPage() {
  const settings = await getCenterSettings();

  const chapters = buildAdminManual({
    openingHour: settings.openingHour,
    closingHour: settings.closingHour,
    minBookingHours: settings.minBookingHours,
    minCancellationHours: settings.minCancellationHours,
    bonoLowThreshold: settings.bonoLowThreshold,
    bonoExpiryMonths: settings.bonoExpiryMonths,
    pendingPaymentCancelEnabled: settings.pendingPaymentCancelEnabled,
    pendingPaymentCancelHours: settings.pendingPaymentCancelHours,
    giftVouchersEnabled: settings.giftVouchersEnabled,
    giftVoucherExpiryMonths: settings.giftVoucherExpiryMonths,
    waitlistEnabled: settings.waitlistEnabled,
    subscriptionsEnabled: settings.subscriptionsEnabled,
    subscriptionExtraSessionsMax: settings.subscriptionExtraSessionsMax,
    trainersSeeColleaguesReservations:
      settings.trainersSeColleaguesReservations,
    referralProgramActive: settings.referralProgramActive,
    referralRewardReferee: settings.referralRewardReferee,
    referralDiscountPercent: settings.referralDiscountPercent,
    reminderHourLocal: settings.reminderHourLocal,
    groupCapacity: GROUP_CAPACITY,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    trialMinAdvanceHours: TRIAL_MIN_ADVANCE_HOURS,
    trialMaxAdvanceDays: TRIAL_MAX_ADVANCE_DAYS,
    bonoExpiryWarningDays: BONO_EXPIRY_WARNING_DAYS,
    stripeEnabled: stripeEnabled(),
    modules: settings.modules,
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-brand-dark">Ajuda</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Com funciona l&apos;àrea d&apos;administració, secció per secció.
          </p>
        </div>
        <PrintManualButton label="Descarregar PDF" />
      </div>

      <HelpManual chapters={chapters} />

      {/* A sobre del botó de suport, que en aquesta àrea ocupa la cantonada. */}
      <BackToTop aboveFab />
    </main>
  );
}
