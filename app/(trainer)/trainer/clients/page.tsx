import { getViewer } from "@/lib/auth";
import { TrainerClientsTable } from "@/components/trainer-clients-table";
import { listClients } from "@/lib/data/clients";

export const dynamic = "force-dynamic";

export default async function TrainerClientsPage() {
  const viewer = await getViewer();
  const trainerId = viewer?.id;

  const [all, mine] = await Promise.all([
    listClients(),
    trainerId ? listClients(trainerId) : Promise.resolve([]),
  ]);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Clients</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Pots consultar la fitxa de qualsevol client per coordinar-te; només
          gestiones (bons i reserves) els teus assignats.
        </p>

        <TrainerClientsTable clients={all} myIds={mine.map((c) => c.id)} />
      </main>
  );
}
