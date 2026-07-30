import { GroupTabs } from "@/components/ui/group-tabs";
import { FACTURACIO_TABS } from "@/app/(admin)/admin/facturacio/tabs";
import { FacturacioNotice } from "@/components/facturacio-notice";
import { RateEditor, type RateRowData } from "@/components/forms/rate-editor";
import { currentRateMap } from "@/lib/data/settlements";
import { SERVICE_TYPES } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function TarifesPage() {
  const rates = await currentRateMap();

  const rows = SERVICE_TYPES.map((st): RateRowData => {
    const r = rates.get(st);
    return {
      serviceType: st,
      amount: r?.rateAmount ?? null,
      effectiveFrom: r?.effectiveFrom ?? null,
    };
  });

  return (
    <>
      <GroupTabs tabs={FACTURACIO_TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Tarifes del centre</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Import que es paga per sessió completada. És el mateix per a tots els
          professionals: no hi ha tarifes diferenciades. Per al grup reduït és
          l&apos;import de la franja sencera, hi vagin els clients que hi vagin.
        </p>

        <FacturacioNotice />

        <p className="mb-4 text-xs text-brand-muted">
          En canviar una tarifa no se&apos;n perd el rastre: la vigent es tanca
          amb data d&apos;ahir i la nova compta a partir d&apos;avui. Les
          liquidacions de períodes anteriors continuen valorant cada sessió amb
          la tarifa que hi havia el dia que es va fer.
        </p>

        <RateEditor rows={rows} />
      </main>
    </>
  );
}
