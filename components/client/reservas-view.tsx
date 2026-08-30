"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ClientCenterCalendar } from "@/components/client-center-calendar";
import {
  SeriesReview,
  type SeriesReviewState,
} from "@/components/forms/series-wizard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import {
  cancelSeriesAction,
  type CancelSeriesState,
} from "@/app/(client)/client/reservas/series-actions";
import { formatDayHeading, formatTime } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { ClientCenterData } from "@/lib/data/client-calendar";
import type { SeriesSummary } from "@/lib/data/booking-series";
import type { ColorPalette } from "@/lib/colors";
import type { CreateAction, CancelAction } from "@/components/client-center-calendar";

/**
 * La pantalla de reserves del client: el calendari de sempre i, al costat,
 * l'assistent de reserva en bucle quan se n'obre un.
 *
 * L'assistent viu AQUÍ i no dins del calendari perquè el calendari ja fa prou
 * feina i perquè així la mateixa graella segueix servint sense assistent allà
 * on no calgui (és el que fa la prop opcional `onPickSeries`).
 */
export function ClientReservasView({
  data,
  palette,
  createAction,
  cancelAction,
  minCancellationHours,
  openingHour,
  closingHour,
  series,
  waitlistEnabled,
  waitlist,
}: {
  data: ClientCenterData;
  palette: ColorPalette;
  createAction: CreateAction;
  cancelAction: CancelAction;
  minCancellationHours: number;
  openingHour: number;
  closingHour: number;
  series: SeriesSummary[];
  /** El centre accepta inscripcions noves a la llista d'espera. */
  waitlistEnabled: boolean;
  /** Les esperes vives del client, per no oferir-li apuntar-s'hi dos cops. */
  waitlist: { id: string; trainerId: string | null; desiredAt: string }[];
}) {
  const router = useRouter();
  // La sèrie ja calculada, esperant que la revisin. La configuració viu ara
  // dins del diàleg de reserva; aquí només hi arriba el resultat.
  const [review, setReview] = useState<SeriesReviewState | null>(null);
  // Quina sèrie s'està cancel·lant. Viu AQUÍ, i no a la fila de la llista,
  // perquè en cancel·lar-la la fila desapareix: si el diàleg hi visqués a
  // dins, se n'aniria amb ella abans que ningú llegís el resultat.
  const [cancelling, setCancelling] = useState<{
    id: string;
    count: number;
  } | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {series.length > 0 && (
        <SeriesList
          series={series}
          onCancel={(id, count) => setCancelling({ id, count })}
        />
      )}

      {cancelling && (
        <CancelSeriesDialog
          seriesId={cancelling.id}
          count={cancelling.count}
          onClose={() => setCancelling(null)}
        />
      )}

      <div
        className={
          review
            ? "grid items-start gap-6 xl:grid-cols-[1fr_26rem]"
            : "grid items-start gap-6"
        }
      >
        <div className="min-w-0">
          <ClientCenterCalendar
            data={data}
            palette={palette}
            createAction={createAction}
            cancelAction={cancelAction}
            minCancellationHours={minCancellationHours}
            openingHour={openingHour}
            closingHour={closingHour}
            onSeriesReady={setReview}
            onDialogOpen={() => setReview(null)}
            waitlistEnabled={waitlistEnabled}
            waitlist={waitlist}
          />
        </div>

        {review && (
          <div className="xl:sticky xl:top-4">
            <SeriesReview
              review={review}
              onClose={() => setReview(null)}
              onDone={() => {
                setReview(null);
                router.refresh();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Les sèries vives, amb l'acció de cancel·lar-les senceres. */
function SeriesList({
  series,
  onCancel,
}: {
  series: SeriesSummary[];
  onCancel: (id: string, count: number) => void;
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
            <span className="text-brand-muted">
              {s.upcoming === 1
                ? t("pendingOne", { count: s.upcoming })
                : t("pendingMany", { count: s.upcoming })}
            </span>
            {s.nextAt && (
              <span className="text-xs text-brand-muted first-letter:uppercase">
                {t("next", {
                  when: `${formatDayHeading(s.nextAt, locale)}, ${formatTime(s.nextAt, locale)}`,
                })}
              </span>
            )}
            <button
              type="button"
              onClick={() => onCancel(s.id, s.upcoming)}
              className="ml-auto rounded-md border border-brand-border px-2.5 py-1 text-xs font-bold text-brand-muted transition-colors hover:border-error hover:text-error"
            >
              {t("cancel")}
            </button>
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
  onClose,
}: {
  seriesId: string;
  count: number;
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
              className="rounded-lg bg-error/10 px-4 py-2 text-sm font-bold text-error hover:bg-error/20"
            >
              {t("close")}
            </button>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <AnimatedFeedback type="cancel" />
            <p className="text-sm font-bold text-brand-dark">
              {t("cancelledCount", { count: state.cancelled ?? 0 })}
            </p>
            <p className="text-sm text-brand-muted">
              {state.kept
                ? state.kept === 1
                  ? t("keptOne")
                  : t("keptMany", { count: state.kept })
                : t("allReturned")}
            </p>
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
                className="rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
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
          <p className="text-sm text-brand-charcoal">
            {t("cancelBody", { count })}
          </p>
          {state.errorCode && (
            <p className="mt-3 text-xs text-error">{te(state.errorCode)}</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
