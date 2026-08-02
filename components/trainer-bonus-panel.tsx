import { computeCurrentBonus } from "@/lib/data/bonus";
import { formatEur, formatDate, SERVICE_LABELS } from "@/lib/labels";

/**
 * Quant queda de període, en text.
 *
 * Un bienni pot deixar més de 700 dies per davant i "queden 731 dies" no diu
 * res a ningú: a partir de dos mesos es parla de mesos, i del darrer mes
 * ençà, de dies.
 */
function timeLeftLabel(periodEnd: string): string {
  const end = new Date(`${periodEnd}T00:00:00`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  const days = Math.max(0, Math.round((end - today) / 86_400_000));

  if (days === 0) return "acaba avui";
  if (days <= 60) return `queden ${days} dies`;

  const months = Math.round(days / 30.4);
  if (months < 24) return `queden uns ${months} mesos`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0
    ? `queden uns ${years} anys`
    : `queden uns ${years} anys i ${rest} mesos`;
}

/**
 * Estat del bonus del professional al seu Inici.
 *
 * No renderitza res —ni un marc buit— si no té el bonus actiu: qui no hi
 * participa no ha de veure cap rastre de la funcionalitat.
 */
export async function TrainerBonusPanel({ trainerId }: { trainerId: string }) {
  const data = await computeCurrentBonus(trainerId);
  if (!data) return null;

  const { progress } = data;
  const left = timeLeftLabel(progress.period.end);
  const tier = progress.currentTier;

  return (
    <section className="rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-brand-purple uppercase">
          El teu bonus
        </h2>
        <span className="text-xs text-brand-muted">
          {progress.period.label} · {left}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            Unitats acumulades
          </p>
          <p className="text-2xl font-bold text-brand-dark">{progress.totalUnits}</p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            Estimació acumulada
          </p>
          <p className="text-2xl font-bold text-brand-purple">
            {formatEur(progress.totalAmount)}
          </p>
        </div>
      </div>

      {tier && (
        <p className="mt-3 text-sm text-brand-charcoal">
          Ara ets al tram de {tier.minUnits} a {tier.maxUnits ?? "∞"} unitats, a{" "}
          {formatEur(tier.ratePerUnit)} per unitat.
          {progress.unitsToNextTier !== null && (
            <>
              {" "}
              Et falten <strong>{progress.unitsToNextTier}</strong> unitats per
              passar al tram següent.
            </>
          )}
        </p>
      )}

      {progress.perService.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-muted">
          {progress.perService.map((p) => (
            <li key={p.serviceType}>
              {p.sessions} × {SERVICE_LABELS[p.serviceType]} ={" "}
              <span className="font-bold text-brand-charcoal">{p.units} u.</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-brand-muted">
        Estimació orientativa amb els pesos i trams d&apos;avui, calculada
        sobre les sessions completades fins ara. No és un import confirmat: el
        bonus no queda fixat fins que l&apos;administració tanca el període (
        {formatDate(progress.period.end)}).
      </p>
    </section>
  );
}
