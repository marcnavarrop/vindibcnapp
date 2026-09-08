import { getCenterSettings } from "@/lib/data/center-settings";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { GROUP_CAPACITY } from "@/lib/labels";
import {
  TRIAL_MIN_ADVANCE_HOURS,
  TRIAL_MAX_ADVANCE_DAYS,
} from "@/lib/data/trial-bookings.constants";
import { buildTrainerManual } from "@/lib/help/trainer-manual";
import { HelpManual } from "@/components/client/help-manual";
import { PrintManualButton } from "@/components/client/print-manual-button";
import { BackToTop } from "@/components/client/back-to-top";

export const dynamic = "force-dynamic";

/**
 * El manual del professional. Segon dels tres.
 *
 * Mateixa peça que el del client: el contingut viu a `lib/help/trainer-manual`
 * i aquí només s'hi aboquen els ajustos de debò. El component que el pinta
 * (`HelpManual`) és literalment el mateix; no sap res del contingut, així que
 * no ha calgut ni tocar-lo.
 *
 * Sense i18n, com la resta de l'àrea de professional: aquesta àrea és en
 * català fix i el proveïdor d'idioma ni tan sols hi arriba.
 *
 * ELS NÚMEROS I ELS CAPÍTOLS SURTEN DE LA CONFIGURACIÓ
 *
 * L'horari del centre, l'aforament, el llindar dels bons baixos i si es veuen
 * les reserves dels companys es llegeixen aquí i s'escriuen al text; i els
 * capítols dels mòduls apagats no es generen. Un manual que explica una
 * pantalla que el centre té tancada menteix cada dia.
 */
export default async function TrainerAjudaPage() {
  const settings = await getCenterSettings();

  const chapters = buildTrainerManual({
    openingHour: settings.openingHour,
    closingHour: settings.closingHour,
    groupCapacity: GROUP_CAPACITY,
    bonoLowThreshold: settings.bonoLowThreshold,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    trainersSeeColleaguesReservations:
      settings.trainersSeColleaguesReservations,
    reminderHourLocal: settings.reminderHourLocal,
    trialMinAdvanceHours: TRIAL_MIN_ADVANCE_HOURS,
    trialMaxAdvanceDays: TRIAL_MAX_ADVANCE_DAYS,
    modules: settings.modules,
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-brand-dark">Ajuda</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Com funciona la teva àrea de professional, secció per secció.
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
