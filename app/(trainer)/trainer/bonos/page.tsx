import { getViewer } from "@/lib/auth";
import { listBonos } from "@/lib/data/bonos";
import { listClients } from "@/lib/data/clients";
import { centerToday } from "@/lib/center-time";
import { TrainerBonosTable } from "@/components/trainer-bonos-table";

export const dynamic = "force-dynamic";

export default async function TrainerBonosPage() {
  const viewer = await getViewer();
  const trainerId = viewer?.id;

  // Els bons de tot el centre i, a part, quins clients són meus. Mateixa
  // parella de consultes que fa la llista de clients: la RLS ja deixa veure-ho
  // tot per coordinació, i qui decideix què es pot cobrar és la segona.
  const [bonos, mine] = await Promise.all([
    listBonos(),
    trainerId ? listClients(trainerId) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Bons</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Tots els bons del centre. Pots cobrar els dels teus clients assignats;
        la resta els veus per coordinar-te. Per crear-ne un, obre la fitxa del
        teu client.
      </p>

      {/* El dia del CENTRE, no el del navegador: la taula l'usa per dir si un
          bo decaigut ja ha passat de data abans de cobrar-lo. */}
      <TrainerBonosTable
        bonos={bonos}
        myClientIds={mine.map((c) => c.id)}
        today={centerToday()}
      />
    </main>
  );
}
