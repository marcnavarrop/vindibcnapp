import { getViewer } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { getClientCenterData } from "@/lib/data/client-calendar";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { ClientReservasView } from "@/components/client/reservas-view";
import { listActiveSeries } from "@/lib/data/booking-series";
import { listWaitlistForClient } from "@/lib/data/waitlist";
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
  const [series, waitlist] = data.clientId
    ? await Promise.all([
        listActiveSeries(data.clientId),
        listWaitlistForClient(data.clientId),
      ])
    : [[], []];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mb-6 text-sm text-brand-muted">
        {t("intro")}
      </p>

      <ClientReservasView
        data={data}
        palette={palette}
        createAction={createOwnReservationAction}
        cancelAction={cancelOwnReservationAction}
        minCancellationHours={centerSettings.minCancellationHours}
        openingHour={centerSettings.openingHour}
        closingHour={centerSettings.closingHour}
        series={series}
        waitlistEnabled={centerSettings.waitlistEnabled}
        // Només les que encara esperen: una de complerta o donada de baixa ja
        // no ha de bloquejar tornar-s'hi a apuntar.
        waitlist={waitlist
          .filter((w) => w.status === "waiting")
          .map((w) => ({ id: w.id, trainerId: w.trainerId, desiredAt: w.desiredAt }))}
      />
    </main>
  );
}
