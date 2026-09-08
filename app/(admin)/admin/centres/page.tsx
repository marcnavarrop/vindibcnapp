import { listCenters } from "@/lib/data/centers";
import { CenterCatalog } from "@/components/forms/center-catalog";
import {
  createCenterAction,
  renameCenterAction,
} from "@/app/(admin)/admin/centres/actions";

export const dynamic = "force-dynamic";

/**
 * Registre de noms de centres. Fase 1 del multi-centre.
 *
 * De moment NO fa res més que anomenar-los: cap client, professional, servei ni
 * reserva pertany encara a un centre concret, i l'app opera com un sol centre
 * exactament com abans. El text de sota ho diu perquè qui hi entri no esperi
 * que crear-ne un de nou reparteixi res.
 */
export default async function CentresPage() {
  const centers = await listCenters();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl text-brand-dark">Centres</h1>
      <p className="mt-1 mb-6 text-sm text-brand-muted">
        El registre de noms dels centres. De moment només serveix per tenir-los
        anomenats: l&apos;app segueix funcionant com un sol centre i encara no hi
        ha res —ni clients, ni professionals, ni serveis, ni reserves— que
        pertanyi a un centre concret.
      </p>

      <CenterCatalog
        centers={centers}
        createAction={createCenterAction}
        renameAction={renameCenterAction}
      />
    </main>
  );
}
