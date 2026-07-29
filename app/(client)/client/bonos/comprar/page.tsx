import { getViewer } from "@/lib/auth";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { getPendingReferralReward } from "@/lib/data/referral";
import { BuyBonoForm } from "@/components/forms/buy-bono-form";
import { RouteTabs } from "@/components/ui/route-tabs";

export const dynamic = "force-dynamic";

const BONO_TABS = [
  { href: "/client/bonos", label: "Els meus bons" },
  { href: "/client/bonos/comprar", label: "Comprar bo nou", accent: true },
];

export default async function ComprarBonoPage() {
  const viewer = await getViewer();

  // El catàleg i la recompensa pendent són independents: s'engeguen alhora.
  // getEffectivePrices SÍ que depèn del catàleg, així que espera només aquest
  // i se solapa amb la recompensa, que continua en vol.
  const servicesPromise = listActiveServices();
  const rewardPromise = viewer
    ? getPendingReferralReward(viewer.id)
    : Promise.resolve(null);

  const services = await servicesPromise;
  const [effectivePricesMap, pendingReferralReward] = await Promise.all([
    getEffectivePrices(services),
    rewardPromise,
  ]);
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">Bonos</h1>
      <RouteTabs tabs={BONO_TABS} />
      <p className="mb-6 text-sm text-brand-muted">
        Tria un servei i com vols pagar-lo.
      </p>

      <BuyBonoForm
        services={services}
        effectivePrices={effectivePrices}
        pendingReferralReward={pendingReferralReward}
      />
    </main>
  );
}
