import { getCenterSettings } from "@/lib/data/center-settings";
import { BONO_EXPIRY_WARNING_DAYS } from "@/lib/data/reminders";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { stripeEnabled } from "@/lib/stripe";
import { GROUP_CAPACITY } from "@/lib/labels";
import { DOCUMENT_MAX_MB } from "@/lib/documents";
import {
  TRIAL_MIN_ADVANCE_HOURS,
  TRIAL_MAX_ADVANCE_DAYS,
} from "@/lib/data/trial-bookings.constants";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/resolve";
import { buildClientManual } from "@/lib/help/client-manual";
import { HelpManual } from "@/components/client/help-manual";
import { PrintManualButton } from "@/components/client/print-manual-button";
import { BackToTop } from "@/components/client/back-to-top";

export const dynamic = "force-dynamic";

/**
 * El manual del client, en l'idioma de qui el llegeix.
 *
 * Els tres manuals es van escriure en català per validar-ne el format abans de
 * traduir res. Validat amb els tres rols, es tradueix NOMÉS aquest: el
 * professional i l'administració treballen en català fix a tota l'app, i
 * traduir-los el manual els deixaria una sola pantalla fora de to.
 *
 * D'ON SURT L'IDIOMA
 *
 * De `resolveLocale()`, que llegeix la cookie. La cookie la manté al dia amb
 * `profiles.preferred_language` el middleware, a cada navegació protegida i
 * només per al rol client. Per això aquí no hi ha cap consulta a la base: la
 * preferència de la persona ja ha arribat.
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
  const [settings, locale, t] = await Promise.all([
    getCenterSettings(),
    resolveLocale(),
    getTranslations("help"),
  ]);

  const chapters = buildClientManual(
    {
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
      bonoExpiryWarningDays: BONO_EXPIRY_WARNING_DAYS,
      minPasswordLength: MIN_PASSWORD_LENGTH,
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
    },
    locale,
  );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
          <p className="mt-1 text-sm text-brand-muted">{t("subtitle")}</p>
        </div>
        <PrintManualButton label={t("downloadPdf")} />
      </div>

      <HelpManual
        chapters={chapters}
        labels={{
          toc: t("toc"),
          tocAria: t("tocAria"),
          warnPrefix: t("warnPrefix"),
        }}
      />

      <BackToTop />
    </main>
  );
}
