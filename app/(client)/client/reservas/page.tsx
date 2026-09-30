import { getViewer } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { getClientCenterData } from "@/lib/data/client-calendar";
import { getCenterSettings } from "@/lib/data/center-settings";
import { centerToday } from "@/lib/center-time";
import { getColorPalette } from "@/lib/data/colors";
import { ClientReservasView } from "@/components/client/reservas-view";
import { getAnyLiveSubscription } from "@/lib/data/subscriptions";
import { listActiveSeries } from "@/lib/data/booking-series";
import { listWaitlistForClient } from "@/lib/data/waitlist";
import { listPastSessions, PAST_SESSIONS_LIMIT } from "@/lib/data/session-notes";
import { PastSessions } from "@/components/client/past-sessions";
import {
  createOwnReservationAction,
  cancelOwnReservationAction,
} from "@/app/(client)/client/reservas/actions";

export const dynamic = "force-dynamic";

export default async function ClientReservasPage() {
  const t = await getTranslations("reservas");
  const viewer = await getViewer();
  const [data, centerSettings, palette] = await Promise.all([
    viewer
      ? getClientCenterData(viewer.id)
      : Promise.resolve({
          clientId: null,
          assignedTrainerId: null,
          bonoTypes: [],
          bonoSessions: {},
          trainers: [],
          rules: [],
          blocks: [],
          reservations: [],
        }),
    getCenterSettings(),
    getColorPalette(),
  ]);

  // Les sèries vives i les esperes del client. Van juntes perquè totes dues
  // depenen del client ja resolt i no s'esperen l'una a l'altra.
  const [series, waitlist, pastSessions] = data.clientId
    ? await Promise.all([
        listActiveSeries(data.clientId),
        listWaitlistForClient(data.clientId),
        // Consulta a part, i amb la sessió del client. `getClientCenterData` va
        // amb la clau de servei i porta les reserves de TOT el centre per pintar
        // el calendari: si la nota hi entrés, s'hi publicarien les dels altres
        // clients pel mateix camí. Aquí qui filtra és la RLS de la 0079.
        listPastSessions(data.clientId),
      ])
    : [[], [], []];

  // La subscripció decideix dues coses a l'assistent: si surt la casella
  // d'allargar la sèrie sola, i si les sessions que falten són un límit o una
  // espera. Només es pregunta si el centre té les subscripcions obertes.
  //
  // Es passa EL SERVEI i no un booleà: des de la 0086 la subscripció pot ser de
  // qualsevol paquet marcat al catàleg, i l'assistent ha de poder comprovar que
  // és del mateix servei que la sèrie abans de prometre que s'allargarà sola.
  const subscription =
    centerSettings.subscriptionsEnabled && data?.clientId
      ? await getAnyLiveSubscription(data.clientId)
      : null;

  // Un sol «ara» per a tota la pantalla, decidit aquí: la llista es pinta al
  // servidor i després al navegador, i totes dues passades han de veure el
  // mateix instant i el mateix dia del centre (vegeu reservas-list.tsx).
  const nowISO = new Date().toISOString();

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      {/* Al mòbil, directe a reservar: la regla d'amb qui ja surt on toca. */}
      <p className="mb-6 hidden text-sm text-brand-muted md:block">
        {t("intro")}
      </p>
      <div className="mb-4 md:hidden" />

      <ClientReservasView
        data={data}
        palette={palette}
        nowISO={nowISO}
        today={centerToday()}
        minBookingHours={centerSettings.minBookingHours}
        createAction={createOwnReservationAction}
        cancelAction={cancelOwnReservationAction}
        minCancellationHours={centerSettings.minCancellationHours}
        openingHour={centerSettings.openingHour}
        closingHour={centerSettings.closingHour}
        series={series}
        waitlistEnabled={centerSettings.waitlistEnabled}
        subscriptionServiceType={subscription?.serviceType ?? null}
        // Només les que encara esperen: una de complerta o donada de baixa ja
        // no ha de bloquejar tornar-s'hi a apuntar. Les passades ja arriben
        // caducades (`sweepExpiredWaitlist`).
        waitlist={waitlist
          .filter((w) => w.status === "waiting")
          .map((w) => ({
            id: w.id,
            trainerId: w.trainerId,
            desiredAt: w.desiredAt,
            serviceType: w.serviceType,
            seriesId: w.seriesId,
          }))}
      />

      {/* Sota el calendari, no dins: reservar i mirar enrere són dues coses
          diferents i el calendari ja té prou feina. */}
      <div className="mt-6">
        <PastSessions sessions={pastSessions} limit={PAST_SESSIONS_LIMIT} />
      </div>
    </main>
  );
}
