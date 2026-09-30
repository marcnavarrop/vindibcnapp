"use client";

import { TAP } from "@/lib/utils";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { MyBookingsHeader, ReservasList, type ClientWait } from "@/components/client/reservas-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import {
  cancelSeriesAction,
  type CancelSeriesState,
} from "@/app/(client)/client/reservas/series-actions";
import { formatDayHeading, formatTime } from "@/lib/labels";
import type { ServiceType } from "@/types/database";
import type { Locale } from "@/lib/i18n/config";
import type { ClientCenterData } from "@/lib/data/client-calendar";
import type { SeriesSummary } from "@/lib/data/booking-series";
import type { ColorPalette } from "@/lib/colors";
import type { CreateAction, CancelAction } from "@/components/client/booking-dialogs";

/**
 * La pantalla de reserves del client.
 *
 *   · Mòbil (C2): una columna. A dalt, les teves properes sessions (amb
 *     «Cancel·lar» a mà) i els bons que et queden; a sota, servei → dia →
 *     hores.
 *   · Escriptori (C3, a partir de `lg`): les mateixes peces en tres columnes.
 *     A l'esquerra les teves sessions, els bons i les sèries; al mig, el servei
 *     i un calendari de tres setmanes; a la dreta, les hores del dia triat.
 *
 * La graella antiga (client-center-calendar.tsx) ja no hi és: era la que
 * provocava l'error d'hidratació #418 i a l'escriptori ja no fa falta.
 *
 * Les tres columnes surten d'una sola graella CSS: la llista es declara
 * `lg:contents` perquè les seves seccions siguin cel·les d'aquesta graella, i
 * així cada peça viu en un sol lloc per a les dues amplades.
 */
export function ClientReservasView({
  data,
  palette,
  createAction,
  cancelAction,
  minCancellationHours,
  minBookingHours,
  openingHour,
  closingHour,
  nowISO,
  today,
  series,
  waitlistEnabled,
  subscriptionServiceType,
  waitlist,
}: {
  data: ClientCenterData;
  /** L'instant de referència i el dia d'avui del centre, del servidor. */
  nowISO: string;
  today: string;
  minBookingHours: number;
  palette: ColorPalette;
  createAction: CreateAction;
  cancelAction: CancelAction;
  minCancellationHours: number;
  openingHour: number;
  closingHour: number;
  series: SeriesSummary[];
  /** El centre accepta inscripcions noves a la llista d'espera. */
  waitlistEnabled: boolean;
  /**
   * De quin servei és la subscripció viva del client, si en té cap.
   *
   * Des de la 0086 un paquet de qualsevol tipus pot anar per subscripció, així
   * que saber que en té una ja no diu de QUÈ: la sèrie només s'allarga sola si
   * la subscripció és del mateix servei.
   */
  subscriptionServiceType: ServiceType | null;
  /** Les esperes vives del client, per no oferir-li apuntar-s'hi dos cops. */
  waitlist: ClientWait[];
}) {
  // Quina sèrie s'està cancel·lant. Viu AQUÍ, i no a la fila de la llista,
  // perquè en cancel·lar-la la fila desapareix: si el diàleg hi visqués a
  // dins, se n'aniria amb ella abans que ningú llegís el resultat.
  const [cancelling, setCancelling] = useState<{
    id: string;
    count: number;
    waiting: number;
  } | null>(null);

  const common = {
    data,
    palette,
    nowISO,
    minCancellationHours,
    cancelAction,
    waitlistEnabled,
    subscriptionServiceType,
  };

  return (
    <div
      className="flex flex-col gap-6 lg:grid lg:grid-cols-[17rem_19rem_minmax(0,1fr)] lg:items-start lg:gap-x-6"
      data-testid="reservas-layout"
    >
      <div className="flex flex-col gap-6 lg:col-start-1 lg:row-span-3 lg:row-start-1">
        <MyBookingsHeader {...common} waitlist={waitlist} />
        {series.length > 0 && (
          <SeriesList
            series={series}
            onCancel={(id, count, waiting) => setCancelling({ id, count, waiting })}
          />
        )}
      </div>

      {cancelling && (
        <CancelSeriesDialog
          seriesId={cancelling.id}
          count={cancelling.count}
          waiting={cancelling.waiting}
          onClose={() => setCancelling(null)}
        />
      )}

      <ReservasList
        {...common}
        today={today}
        minBookingHours={minBookingHours}
        openingHour={openingHour}
        closingHour={closingHour}
        createAction={createAction}
        waitlist={waitlist}
      />
    </div>
  );
}

/** Les sèries vives, amb l'acció de cancel·lar-les senceres. */
function SeriesList({
  series,
  onCancel,
}: {
  series: SeriesSummary[];
  onCancel: (id: string, count: number, waiting: number) => void;
}) {
  const t = useTranslations("reservas.series");
  const tl = useTranslations("labels.service");
  const tf = useTranslations("wizard.frequency");
  const locale = useLocale() as Locale;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
        {t("title")}
      </h2>
      <div className="divide-y divide-brand-border">
        {series.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
          >
            <span className="font-bold text-brand-dark">
              {tl(s.serviceType)}
            </span>
            <span className="text-brand-muted">
              {t("every", { frequency: tf(s.frequency).toLowerCase() })}
            </span>
            {s.upcoming > 0 && (
              <span className="text-brand-muted">
                {s.upcoming === 1
                  ? t("pendingOne", { count: s.upcoming })
                  : t("pendingMany", { count: s.upcoming })}
              </span>
            )}
            {s.waiting > 0 && (
              <span className="text-brand-muted" data-testid="series-waiting">
                {t("waiting", { count: s.waiting })}
              </span>
            )}
            {s.nextAt && (
              <span className="text-xs text-brand-muted first-letter:uppercase">
                {t("next", {
                  when: `${formatDayHeading(s.nextAt, locale)}, ${formatTime(s.nextAt, locale)}`,
                })}
              </span>
            )}
            <button
              type="button"
              onClick={() => onCancel(s.id, s.upcoming, s.waiting)}
              className={`ml-auto min-h-11 rounded-md border border-brand-border px-3 py-1 text-xs font-bold text-brand-muted transition-colors hover:border-error hover:text-error active:bg-brand-bg ${TAP}`}
            >
              {t("cancel")}
            </button>
            {s.stoppedTrainerChanged && (
              <p
                data-testid="series-stopped"
                className="w-full rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
              >
                {t("stoppedTrainerChanged")}
              </p>
            )}
            {s.waitingBlocked && (
              <p
                data-testid="series-waiting-blocked"
                className="w-full rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
              >
                {t("waitingBlocked")}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Cancel·lar la sèrie sencera, amb el resultat dins del mateix diàleg.
 *
 * El "X cancel·lades" es va escriure primer dins de la fila de la llista i no
 * s'arribava a llegir mai: el `revalidatePath` del server action repinta la
 * pàgina, la sèrie ja no hi surt i la fila —amb el missatge a dins— se'n va
 * abans que ningú el vegi. Retardar el `router.refresh()` no ho arreglava,
 * perquè qui esborrava el missatge era la revalidació, no el refresc.
 *
 * Per això el diàleg penja de la vista sencera i no de la fila: la llista pot
 * desaparèixer a sota que el resultat es queda a la pantalla, amb el mateix tic
 * animat que la cancel·lació d'una reserva solta, fins que es tanca.
 */
function CancelSeriesDialog({
  seriesId,
  count,
  waiting,
  onClose,
}: {
  seriesId: string;
  count: number;
  /** Sessions de la sèrie a la cua: cancel·lar la sèrie també les treu. */
  waiting: number;
  onClose: () => void;
}) {
  const t = useTranslations("reservas.series");
  const te = useTranslations("reservas.errors");
  const [state, action] = useActionState(
    cancelSeriesAction,
    {} as CancelSeriesState,
  );

  return (
    <>
      {state.ok ? (
        <ConfirmDialog
        ariaClose={t("close")}
          open
          onClose={onClose}
          title={t("cancelledTitle")}
          actions={
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg bg-error/10 px-4 py-2 text-sm font-bold text-error hover:bg-error/20 active:bg-error/30 ${TAP}`}
            >
              {t("close")}
            </button>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <AnimatedFeedback type="cancel" />
            {/* Una sèrie que només tenia esperes no ha cancel·lat cap sessió:
                «0 sessions cancel·lades» seria un resultat estrany. */}
            {((state.cancelled ?? 0) > 0 || waiting === 0) && (
              <p className="text-sm font-bold text-brand-dark">
                {t("cancelledCount", { count: state.cancelled ?? 0 })}
              </p>
            )}
            {(state.cancelled ?? 0) + (state.kept ?? 0) > 0 && (
              <p className="text-sm text-brand-muted">
                {state.kept
                  ? state.kept === 1
                    ? t("keptOne")
                    : t("keptMany", { count: state.kept })
                  : t("allReturned")}
              </p>
            )}
            {waiting > 0 && (
              <p className="text-sm text-brand-muted">{t("waitsLeft", { count: waiting })}</p>
            )}
          </div>
        </ConfirmDialog>
      ) : (
        <ConfirmDialog
        ariaClose={t("close")}
          open
          onClose={onClose}
          title={t("cancelTitle")}
          actions={
            <>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark active:bg-brand-bg ${TAP}`}
              >
                {t("keepIt")}
              </button>
              <form action={action}>
                <input type="hidden" name="seriesId" value={seriesId} />
                <SubmitButton pendingLabel={t("cancelling")}>
                  {t("cancelAll")}
                </SubmitButton>
              </form>
            </>
          }
        >
          {count > 0 && (
            <p className="text-sm text-brand-charcoal">
              {t("cancelBody", { count })}
            </p>
          )}
          {waiting > 0 && (
            <p className={`text-sm text-brand-charcoal ${count > 0 ? "mt-2" : ""}`}>
              {t("cancelWaiting", { count: waiting })}
            </p>
          )}
          {state.errorCode && (
            <p className="mt-3 text-xs text-error">{te(state.errorCode)}</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
