import { getViewer } from "@/lib/auth";
import { TrainerClientsTable } from "@/components/trainer-clients-table";
import { listClientsPage, listTrainers } from "@/lib/data/clients";

export const dynamic = "force-dynamic";

export default async function TrainerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tots?: string; professional?: string }>;
}) {
  const viewer = await getViewer();
  // Sense sessió no hi ha «els meus»: amb un id buit, el filtre desapareixeria
  // i sortirien tots. El middleware ja ho impedeix; això no en depèn.
  if (!viewer) return null;
  const { q: rawQ, tots, professional } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 60);
  const scope = tots === "1" ? "all" : "mine";
  // A «Tots», la cartera d'un company. Abans es feia escrivint el seu nom al
  // cercador; ara la cerca va al servidor i és un filtre per id, exacte.
  const professionalId = scope === "all" && professional ? professional : null;

  // «Els meus» amb el SEU id, mai un que arribi per l'adreça.
  const [page, trainers] = await Promise.all([
    listClientsPage({ q, trainerId: scope === "mine" ? viewer.id : professionalId }),
    scope === "all" ? listTrainers() : Promise.resolve([]),
  ]);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Clients</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Pots consultar la fitxa de qualsevol client per coordinar-te; només
          gestiones (bons i reserves) els teus assignats.
        </p>

        <TrainerClientsTable
          initialRows={page.items}
          initialCursor={page.nextCursor}
          total={page.total}
          q={q}
          scope={scope}
          professionalId={professionalId}
          trainers={trainers}
        />
      </main>
  );
}
