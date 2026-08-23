import { getViewer } from "@/lib/auth";
import { getClientCenterData } from "@/lib/data/client-calendar";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { ClientReservasView } from "@/components/client/reservas-view";
import { listActiveSeries } from "@/lib/data/booking-series";
import {
  createOwnReservationAction,
  cancelOwnReservationAction,
} from "@/app/(client)/client/reservas/actions";

export const dynamic = "force-dynamic";

export default async function ClientReservasPage() {
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

  // Les sèries vives del client, per poder-les cancel·lar senceres.
  const series = data.clientId ? await listActiveSeries(data.clientId) : [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Reserves</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Reserva en qualsevol franja lliure del centre. Veus les disponibilitats
        de tots els professionals segons els serveis dels teus bons. Des del
        diàleg de reserva pots repetir-la en bucle.
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
      />
    </main>
  );
}
