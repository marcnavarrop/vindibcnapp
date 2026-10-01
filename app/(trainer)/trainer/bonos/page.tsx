import { getViewer } from "@/lib/auth";
import {
  BONO_FILTERS,
  countCollectableByStatus,
  listBonosPage,
  type BonoFilter,
} from "@/lib/data/bonos";
import { centerToday } from "@/lib/center-time";
import { SERVICE_TYPES } from "@/lib/labels";
import { TrainerBonosTable } from "@/components/trainer-bonos-table";
import type { ServiceType } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TrainerBonosPage({
  searchParams,
}: {
  searchParams: Promise<{ tots?: string; estat?: string; q?: string; servei?: string }>;
}) {
  const viewer = await getViewer();
  // Sense sessió no hi ha «els meus»: amb un id buit el filtre desapareixeria.
  if (!viewer) return null;

  const { tots, estat, q: rawQ, servei } = await searchParams;
  const view = {
    scope: tots === "1" ? ("all" as const) : ("mine" as const),
    filter: BONO_FILTERS.includes(estat as BonoFilter) ? (estat as BonoFilter) : ("all" as BonoFilter),
    q: (rawQ ?? "").trim().slice(0, 60),
    serviceType: SERVICE_TYPES.includes(servei as ServiceType) ? (servei as ServiceType) : null,
  };

  // Els bons del centre per pàgines, amb els filtres a la base. La RLS ja
  // deixa veure-ho tot per coordinació (0005); «Els meus» és una comoditat de
  // lectura i va amb el SEU id. Els comptadors són de tot el centre.
  const [page, counts] = await Promise.all([
    listBonosPage({
      filter: view.filter,
      q: view.q,
      serviceType: view.serviceType,
      assignedTrainerId: view.scope === "mine" ? viewer.id : null,
    }),
    countCollectableByStatus(),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Bons</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Tots els bons del centre. Pots cobrar qualsevol bo pendent, sigui de
        qui sigui el client, i anul·lar els pendents que encara no s&apos;han
        fet servir. Per crear-ne un, obre la fitxa del teu client.
      </p>

      {/* El dia del CENTRE, no el del navegador: la taula l'usa per dir si un
          bo decaigut ja ha passat de data abans de cobrar-lo. */}
      <TrainerBonosTable
        initialRows={page.items}
        initialCursor={page.nextCursor}
        total={page.total}
        view={view}
        counts={counts}
        today={centerToday()}
      />
    </main>
  );
}
