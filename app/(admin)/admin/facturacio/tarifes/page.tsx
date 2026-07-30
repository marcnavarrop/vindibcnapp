import { GroupTabs } from "@/components/ui/group-tabs";
import { FACTURACIO_TABS } from "@/app/(admin)/admin/facturacio/tabs";
import { FacturacioNotice } from "@/components/facturacio-notice";
import { RateEditor, type RateRowData } from "@/components/forms/rate-editor";
import { listTrainers } from "@/lib/data/clients";
import { currentRateMap } from "@/lib/data/settlements";
import { SERVICE_TYPES } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function TarifesPage() {
  const [trainers, rates] = await Promise.all([listTrainers(), currentRateMap()]);

  const data = trainers.map((t) => ({
    id: t.id,
    name: t.name,
    rows: SERVICE_TYPES.map((st): RateRowData => {
      const r = rates.get(`${t.id}|${st}`);
      return {
        serviceType: st,
        amount: r?.rateAmount ?? null,
        effectiveFrom: r?.effectiveFrom ?? null,
      };
    }),
  }));

  return (
    <>
      <GroupTabs tabs={FACTURACIO_TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Tarifes per professional</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Import que cobra cada professional per sessió completada. Per al grup
          reduït és l&apos;import de la franja sencera, hi vagin els clients que
          hi vagin.
        </p>

        <FacturacioNotice />

        <p className="mb-4 text-xs text-brand-muted">
          En canviar una tarifa no se&apos;n perd el rastre: la vigent es tanca
          amb data d&apos;ahir i la nova compta a partir d&apos;avui. Les
          liquidacions de períodes anteriors continuen valorant cada sessió amb
          la tarifa que hi havia el dia que es va fer.
        </p>

        <RateEditor trainers={data} />
      </main>
    </>
  );
}
