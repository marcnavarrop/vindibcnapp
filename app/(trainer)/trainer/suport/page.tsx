import { listSupportTickets } from "@/lib/data/support";
import { SupportPanel } from "@/components/support-panel";
import { createTicketTrainerAction } from "@/app/(trainer)/trainer/suport/actions";

export const dynamic = "force-dynamic";

export default async function TrainerSuportPage() {
  // La RLS ja hi deixa només els seus: aquí no cal filtrar res.
  const tickets = await listSupportTickets();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Suport</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Has trobat un error o tens un dubte sobre l&apos;app? Explica&apos;l
        aquí i arribarà a qui la desenvolupa.
      </p>

      {/* Sense setStatusAction: el professional veu l'estat, no el canvia. */}
      <SupportPanel tickets={tickets} createAction={createTicketTrainerAction} />
    </main>
  );
}
