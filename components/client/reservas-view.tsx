"use client";

import { useState } from "react";
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
import {
  SERVICE_LABELS,
  FREQUENCY_LABELS,
  formatDayHeading,
  formatTime,
} from "@/lib/labels";
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
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
        Les meves sèries
      </h2>
      <div className="divide-y divide-brand-border">
        {series.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
          >
            <span className="font-bold text-brand-dark">
              {SERVICE_LABELS[s.serviceType]}
            </span>
            <span className="text-brand-muted">
              cada {FREQUENCY_LABELS[s.frequency].toLowerCase()}
            </span>
            <span className="text-brand-muted">
              {s.upcoming} {s.upcoming === 1 ? "sessió pendent" : "sessions pendents"}
            </span>
            {s.nextAt && (
              <span className="text-xs text-brand-muted capitalize">
                pròxima: {formatDayHeading(s.nextAt)}, {formatTime(s.nextAt)}
              </span>
            )}
            <button
              type="button"
              onClick={() => onCancel(s.id, s.upcoming)}
              className="ml-auto rounded-md border border-brand-border px-2.5 py-1 text-xs font-bold text-brand-muted transition-colors hover:border-error hover:text-error"
            >
              Cancel·lar la sèrie
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
  const [state, action] = useActionState(
    cancelSeriesAction,
    {} as CancelSeriesState,
  );

  return (
    <>
      {state.ok ? (
        <ConfirmDialog
          open
          onClose={onClose}
          title="Sèrie cancel·lada"
          actions={
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-error/10 px-4 py-2 text-sm font-bold text-error hover:bg-error/20"
            >
              Tancar
            </button>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <AnimatedFeedback type="cancel" />
            <p className="text-sm font-bold text-brand-dark">
              {state.cancelled}{" "}
              {state.cancelled === 1
                ? "sessió cancel·lada"
                : "sessions cancel·lades"}
            </p>
            <p className="text-sm text-brand-muted">
              {state.kept
                ? `${state.kept === 1 ? "Una sessió s'ha quedat" : `${state.kept} sessions s'han quedat`} perquè ja eren massa a prop per cancel·lar-les.`
                : "Les sessions han tornat al teu bo."}
            </p>
          </div>
        </ConfirmDialog>
      ) : (
        <ConfirmDialog
          open
          onClose={onClose}
          title="Cancel·lar tota la sèrie?"
          actions={
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
              >
                Deixar-ho estar
              </button>
              <form action={action}>
                <input type="hidden" name="seriesId" value={seriesId} />
                <SubmitButton pendingLabel="Cancel·lant…">
                  Cancel·lar-les totes
                </SubmitButton>
              </form>
            </>
          }
        >
          <p className="text-sm text-brand-charcoal">
            S&apos;anul·laran les {count} sessions futures d&apos;aquesta sèrie i
            les sessions tornaran al teu bo. Les que ja estiguin massa a prop per
            cancel·lar-se es quedaran, i t&apos;ho direm.
          </p>
          {state.error && (
            <p className="mt-3 text-xs text-error">{state.error}</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
