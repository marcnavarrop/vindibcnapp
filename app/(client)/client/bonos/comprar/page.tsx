import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { BuyBonoForm } from "@/components/forms/buy-bono-form";
import { RouteTabs } from "@/components/ui/route-tabs";

export const dynamic = "force-dynamic";

const BONO_TABS = [
  { href: "/client/bonos", label: "Els meus bons" },
  { href: "/client/bonos/comprar", label: "Comprar bo nou", accent: true },
];

export default async function ComprarBonoPage() {
  const services = await listActiveServices();
  const effectivePricesMap = await getEffectivePrices(services);
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">Bonos</h1>
      <RouteTabs tabs={BONO_TABS} />
      <p className="mb-6 text-sm text-brand-muted">
        Tria un servei i com vols pagar-lo.
      </p>

      <BuyBonoForm services={services} effectivePrices={effectivePrices} />
    </main>
  );
}
