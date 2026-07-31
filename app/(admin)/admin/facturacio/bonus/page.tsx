import { GroupTabs } from "@/components/ui/group-tabs";
import { FACTURACIO_TABS } from "@/app/(admin)/admin/facturacio/tabs";
import { FacturacioNotice } from "@/components/facturacio-notice";
import {
  BonusWeightsEditor,
  type WeightRowData,
} from "@/components/forms/bonus-weights-editor";
import { BonusTiersEditor } from "@/components/forms/bonus-tiers-editor";
import {
  BonusWorkersEditor,
  type WorkerRowData,
} from "@/components/forms/bonus-workers-editor";
import { listTrainers } from "@/lib/data/clients";
import {
  currentWeightMap,
  listTiers,
  listWorkerSettings,
  listPayouts,
  computeBonus,
  periodFor,
} from "@/lib/data/bonus";
import { SERVICE_TYPES, formatEur, formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** Bloc temàtic amb barra lateral, com a Configuració. */
function Group({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold tracking-wide text-brand-purple uppercase">
        {title}
      </h2>
      <p className="mt-0.5 mb-4 text-xs text-brand-muted">{desc}</p>
      {children}
    </section>
  );
}

export default async function BonusPage() {
  const [trainers, weights, tiers, workerSettings, payouts] = await Promise.all([
    listTrainers(),
    currentWeightMap(),
    listTiers(),
    listWorkerSettings(),
    listPayouts(),
  ]);

  const weightRows = SERVICE_TYPES.map((st): WeightRowData => {
    const w = weights.get(st);
    return {
      serviceType: st,
      weight: w?.weight ?? null,
      effectiveFrom: w?.effectiveFrom ?? null,
    };
  });

  // L'estat del període en curs només es calcula per als qui tenen el bonus
  // actiu: per a la resta no hi ha res a mostrar.
  const workerRows: WorkerRowData[] = await Promise.all(
    trainers.map(async (t) => {
      const s = workerSettings.find((w) => w.trainerId === t.id);
      const enabled = s?.enabled ?? false;
      const frequency = s?.payoutFrequency ?? "annual";
      if (!enabled) {
        return {
          trainerId: t.id,
          name: t.name,
          enabled,
          payoutFrequency: frequency,
          current: null,
        };
      }
      const period = periodFor(frequency);
      const progress = await computeBonus(t.id, period, frequency);
      return {
        trainerId: t.id,
        name: t.name,
        enabled,
        payoutFrequency: frequency,
        current: {
          periodLabel: period.label,
          units: progress.totalUnits,
          amount: progress.totalAmount,
        },
      };
    }),
  );

  const trainerName = (id: string) =>
    trainers.find((t) => t.id === id)?.name ?? "—";

  return (
    <>
      <GroupTabs tabs={FACTURACIO_TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Bonus per volum</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Cada sessió completada val unes unitats segons el servei. Les unitats
          del període se sumen i es paguen per trams progressius: les primeres
          unitats a un preu i les següents a un altre, com els trams
          d&apos;IRPF.
        </p>

        <FacturacioNotice />

        <Group
          title="Pesos per servei"
          desc="Quantes unitats aporta una sessió completada de cada tipus. Igual per a tots els professionals."
        >
          <BonusWeightsEditor rows={weightRows} />
        </Group>

        <Group
          title="Trams"
          desc="Preu per unitat segons el volum acumulat del període. Es cobra per trams, no tot al preu del tram més alt."
        >
          <BonusTiersEditor
            tiers={tiers.map((t) => ({
              minUnits: t.minUnits,
              maxUnits: t.maxUnits,
              ratePerUnit: t.ratePerUnit,
            }))}
          />
        </Group>

        <Group
          title="Treballadors"
          desc="Qui té bonus i cada quant se li tanca. És l'únic paràmetre que varia per professional."
        >
          <BonusWorkersEditor rows={workerRows} />
        </Group>

        <Group
          title="Bonus tancats"
          desc="Fotografia fixa del càlcul: no canvien encara que després es modifiquin pesos o trams."
        >
          {payouts.length === 0 ? (
            <p className="rounded-2xl border border-brand-border bg-white p-5 text-sm text-brand-muted">
              Encara no se n&apos;ha tancat cap.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {payouts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-2xl border border-brand-border bg-white p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-bold text-brand-dark">
                        {trainerName(p.trainerId)}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {formatDate(p.periodStart)} – {formatDate(p.periodEnd)} ·{" "}
                        {p.totalUnits} unitats · tancat el{" "}
                        {formatDate(p.generatedAt)}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-brand-purple">
                      {formatEur(p.totalAmount)}
                    </span>
                  </div>
                  {p.tierBreakdown.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-muted">
                      {p.tierBreakdown.map((l, i) => (
                        <li key={i}>
                          {l.unitsInTier} u. de {l.minUnits} a{" "}
                          {l.maxUnits ?? "∞"} × {formatEur(l.ratePerUnit)} ={" "}
                          <span className="font-bold text-brand-charcoal">
                            {formatEur(l.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Group>
      </main>
    </>
  );
}
