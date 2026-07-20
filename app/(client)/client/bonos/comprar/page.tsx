import Link from "next/link";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { BuyBonoForm } from "@/components/forms/buy-bono-form";

export const dynamic = "force-dynamic";

export default async function ComprarBonoPage() {
  const services = await listActiveServices();
  const effectivePricesMap = await getEffectivePrices(services);
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link
        href="/client/bonos"
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
      >
        ← Tornar als bonos
      </Link>
      <h1 className="mt-1 mb-2 text-2xl text-brand-dark">Comprar bo nou</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Tria un servei i com vols pagar-lo.
      </p>

      <BuyBonoForm services={services} effectivePrices={effectivePrices} />
    </main>
  );
}
