import { getViewer } from "@/lib/auth";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { getPendingReferralReward } from "@/lib/data/referral";
import { getColorPalette } from "@/lib/data/colors";
import { getCenterSettings } from "@/lib/data/center-settings";
import Link from "next/link";
import { Gift } from "lucide-react";
import { stripeEnabled } from "@/lib/stripe";
import { BuyBonoForm } from "@/components/forms/buy-bono-form";
import { RouteTabs } from "@/components/ui/route-tabs";

export const dynamic = "force-dynamic";

const BONO_TABS = [
  { href: "/client/bonos/comprar", label: "Comprar bo nou", accent: true },
  { href: "/client/bonos", label: "Els meus bons" },
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
  const [effectivePricesMap, pendingReferralReward, palette, settings] =
    await Promise.all([
      getEffectivePrices(services),
      rewardPromise,
      getColorPalette(),
      getCenterSettings(),
    ]);
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">Bons</h1>
      <RouteTabs tabs={BONO_TABS} />
      <p className="mb-6 text-sm text-brand-muted">
        Tria un servei i com vols pagar-lo.
      </p>

      <BuyBonoForm
        services={services}
        palette={palette}
        effectivePrices={effectivePrices}
        pendingReferralReward={pendingReferralReward}
        stripeEnabled={stripeEnabled()}
      />

      {/*
        Fins ara a "Regala Vindi" només s'hi arribava des de l'Inici, i qui
        entrava a comprar un bo ja no el tornava a veure —justament qui està
        pensant en paquets de sessions—. Va aquí i no com a tercera pestanya
        perquè no és una altra manera de mirar els teus bons: és una compra per
        a algú altre.

        Condicionat a l'interruptor del centre: /client/regals respon 404 amb el
        mòdul apagat, i un enllaç que porta a un 404 és pitjor que cap enllaç.
      */}
      {settings.giftVouchersEnabled && (
        <Link
          href="/client/regals"
          className="mt-8 flex items-center gap-4 rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-orange"
        >
          <span
            aria-hidden
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange"
          >
            <Gift className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold text-brand-dark">
              També pots regalar Vindi a algú
            </span>
            <span className="text-xs text-brand-muted">
              El mateix paquet de sessions, amb un codi i la teva dedicatòria.
            </span>
          </span>
          <span aria-hidden className="ml-auto text-brand-orange">
            →
          </span>
        </Link>
      )}
    </main>
  );
}
