"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ClientCenterCalendar } from "@/components/client-center-calendar";
import { SeriesWizard, type SeriesSeed } from "@/components/forms/series-wizard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
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
}: {
  data: ClientCenterData;
  palette: ColorPalette;
  createAction: CreateAction;
  cancelAction: CancelAction;
  minCancellationHours: number;
  openingHour: number;
  closingHour: number;
  series: SeriesSummary[];
}) {
  const router = useRouter();
  const [seed, setSeed] = useState<SeriesSeed | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {series.length > 0 && <SeriesList series={series} />}

      <div
        className={
          seed
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
            onPickSeries={(s) =>
              setSeed({
                scheduledAt: s.scheduledAt,
                trainerId: s.trainerId,
                trainerName: s.trainerName,
                serviceType: s.service,
              })
            }
          />
        </div>

        {seed && (
          <div className="xl:sticky xl:top-4">
            <SeriesWizard
              seed={seed}
              onClose={() => setSeed(null)}
              onDone={() => {
                setSeed(null);
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
function SeriesList({ series }: { series: SeriesSummary[] }) {
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
            <CancelSeriesButton seriesId={s.id} count={s.upcoming} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CancelSeriesButton({
  seriesId,
  count,
}: {
  seriesId: string;
  count: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    cancelSeriesAction,
    {} as CancelSeriesState,
  );

  if (state.ok)
    return (
      <span className="ml-auto text-xs font-bold text-success">
        {state.cancelled} cancel·lades
        {state.kept ? ` · ${state.kept} massa a prop per cancel·lar` : ""}
      </span>
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto rounded-md border border-brand-border px-2.5 py-1 text-xs font-bold text-brand-muted transition-colors hover:border-error hover:text-error"
      >
        Cancel·lar la sèrie
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel·lar tota la sèrie?"
        actions={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
            >
              Deixar-ho estar
            </button>
            <form
              action={(fd) => {
                action(fd);
                setOpen(false);
                router.refresh();
              }}
            >
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
      </ConfirmDialog>
      {state.error && (
        <span className="ml-auto text-xs text-error">{state.error}</span>
      )}
    </>
  );
}
