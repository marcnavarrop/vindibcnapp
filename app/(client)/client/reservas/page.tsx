import { getViewer } from "@/lib/auth";
import { getClientCenterData } from "@/lib/data/client-calendar";
import { getCenterSettings } from "@/lib/data/center-settings";
import { ClientCenterCalendar } from "@/components/client-center-calendar";
import {
  createOwnReservationAction,
  cancelOwnReservationAction,
} from "@/app/(client)/client/reservas/actions";

export const dynamic = "force-dynamic";

export default async function ClientReservasPage() {
  const viewer = await getViewer();
  const [data, centerSettings] = await Promise.all([
    viewer
      ? getClientCenterData(viewer.id)
      : Promise.resolve({
          clientId: null,
          bonoTypes: [],
          trainers: [],
          rules: [],
          reservations: [],
        }),
    getCenterSettings(),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Reserves</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Reserva en qualsevol franja lliure del centre. Veus les disponibilitats
        de tots els professionals segons els serveis dels teus bons.
      </p>

      <ClientCenterCalendar
        data={data}
        createAction={createOwnReservationAction}
        cancelAction={cancelOwnReservationAction}
        minCancellationHours={centerSettings.minCancellationHours}
      />
    </main>
  );
}
