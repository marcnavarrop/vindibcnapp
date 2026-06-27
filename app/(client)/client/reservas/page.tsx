import { getViewer } from "@/lib/auth";
import { getClientReservationData } from "@/lib/data/reservations";
import { listAvailabilityLite } from "@/lib/data/availability";
import { ClientWeeklyCalendar } from "@/components/client-weekly-calendar";
import {
  createOwnReservationAction,
  cancelOwnReservationAction,
} from "@/app/(client)/client/reservas/actions";

export const dynamic = "force-dynamic";

export default async function ClientReservasPage() {
  const viewer = await getViewer();
  const data = viewer
    ? await getClientReservationData(viewer.id)
    : {
        clientId: null,
        trainerId: null,
        trainerName: null,
        bonos: [],
        reservations: [],
      };
  const availability = data.trainerId
    ? await listAvailabilityLite(data.trainerId)
    : [];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Reserves</h1>
      <p className="mb-6 text-sm text-brand-muted">
        {data.trainerName
          ? `Agenda del teu entrenador/a, ${data.trainerName}. Reserva en una franja lliure consumint una sessió del teu bo.`
          : "Encara no tens entrenador/a assignat/da. Parla amb el centre per poder reservar."}
      </p>

      {data.trainerName && (
        <ClientWeeklyCalendar
          reservations={data.reservations}
          bonos={data.bonos}
          trainerName={data.trainerName}
          availability={availability}
          createAction={createOwnReservationAction}
          cancelAction={cancelOwnReservationAction}
        />
      )}
    </main>
  );
}
