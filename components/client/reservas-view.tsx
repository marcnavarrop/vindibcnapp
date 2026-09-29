"use client";

import { TAP } from "@/lib/utils";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ClientCenterCalendar } from "@/components/client-center-calendar";
import { MyBookingsHeader, ReservasList } from "@/components/client/reservas-list";
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
import type { ServiceType } from "@/types/database";
import type { Locale } from "@/lib/i18n/config";
import type { ClientCenterData } from "@/lib/data/client-calendar";
import type { SeriesSummary } from "@/lib/data/booking-series";
import type { ColorPalette } from "@/lib/colors";
import type { CreateAction, CancelAction } from "@/components/client-center-calendar";

/** A partir d'aquí (el `md` de Tailwind) la pantalla és d'escriptori. */
const DESKTOP_QUERY = "(min-width: 768px)";
function subscribeDesktop(cb: () => void) {
  const m = window.matchMedia(DESKTOP_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/**
 * La pantalla de reserves del client.
 *
 * Des de C2:
 *   · A dalt, a totes les amplades, les teves properes sessions (amb
 *     «Cancel·lar» a mà) i els bons que et queden.
 *   · Al mòbil, la llista nova: servei → dia → hores (`ReservasList`).
 *   · A l'escriptori, la graella de sempre fins a C3.
 *
 * LA GRAELLA NOMÉS ES PINTA AL NAVEGADOR. Compta les hores amb el rellotge local
 * del procés: al servidor (UTC) la primera fila li sortia a les 06:00 i al
 * navegador (Madrid) a les 07:00, i React ho detectava com a error d'hidratació
 * #418. Pintar-la només al navegador —i només si la pantalla és d'escriptori—
 * treu l'error i, de passada, estalvia al mòbil tota la feina d'una graella
 * que no s'hi veu. La llista, en canvi, es pinta al servidor sense problema:
 * compta en hora del centre.
 *
 * L'assistent de sèries viu AQUÍ i no dins de cap de les dues perquè el fan
 * servir totes dues.
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
   * Abans era un booleà. Des de la 0086 un paquet de qualsevol tipus pot anar
   * per subscripció, així que saber que en té una ja no diu de QUÈ: la sèrie
   * només s'allarga sola si la subscripció és del mateix servei.
   */
  subscriptionServiceType: ServiceType | null;
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
  // Al servidor i en la primera passada del navegador, `false`: la graella no
  // hi és. Després, el que digui la pantalla.
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  // Al mòbil la revisió de la sèrie surt sota la llista: s'hi porta la vista
  // perquè qui ha premut «Veure les sessions» la vegi sense haver de buscar-la.
  const reviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (review) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [review]);

  const common = {
    data,
    palette,
    nowISO,
    minCancellationHours,
    cancelAction,
    waitlistEnabled,
    subscriptionServiceType,
    onSeriesReady: setReview,
    onDialogOpen: () => setReview(null),
  };

  return (
    <div className="flex flex-col gap-6">
      <MyBookingsHeader {...common} />

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
          <div className="md:hidden">
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
          {desktop && (
            <div className="hidden md:block" data-testid="desktop-grid">
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
                subscriptionServiceType={subscriptionServiceType}
                waitlist={waitlist}
              />
            </div>
          )}
        </div>

        {review && (
          <div ref={reviewRef} className="scroll-mt-4 xl:sticky xl:top-4">
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
              className={`rounded-lg bg-error/10 px-4 py-2 text-sm font-bold text-error hover:bg-error/20 active:bg-error/30 ${TAP}`}
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
