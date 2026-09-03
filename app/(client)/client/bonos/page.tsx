import { TAP_SURFACE } from "@/lib/utils";
import { getViewer } from "@/lib/auth";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { getPendingReferralReward } from "@/lib/data/referral";
import { getClientByProfile } from "@/lib/data/clients";
import { getColorPalette } from "@/lib/data/colors";
import { getCenterSettings } from "@/lib/data/center-settings";
import Link from "next/link";
import { Gift } from "lucide-react";
import { stripeEnabled } from "@/lib/stripe";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";
import { hasOutstandingGiftVouchers } from "@/lib/data/gift-vouchers";
import { RedeemGiftVoucher } from "@/components/forms/redeem-gift-voucher";
import { BuyBonoForm } from "@/components/forms/buy-bono-form";
import { RouteTabs } from "@/components/ui/route-tabs";

export const dynamic = "force-dynamic";

export default async function ComprarBonoPage() {
  const viewer = await getViewer();

  // El catàleg i la recompensa pendent són independents: s'engeguen alhora.
  // getEffectivePrices SÍ que depèn del catàleg, així que espera només aquest
  // i se solapa amb la recompensa, que continua en vol.
  const servicesPromise = listActiveServices();
  const rewardPromise = viewer
    ? getPendingReferralReward(viewer.id)
    : Promise.resolve(null);
  // La fitxa de client fa falta pel seu `id`: `getEffectivePrices` segmenta per
  // client_id, i el que tenim aquí és el profile_id de la sessió. Va en paral·lel
  // amb la resta, que no en depèn.
  const clientPromise = viewer
    ? getClientByProfile(viewer.id)
    : Promise.resolve(null);

  const services = await servicesPromise;
  const locale = (await getLocale()) as Locale;
  const client = await clientPromise;
  const [effectivePricesMap, pendingReferralReward, palette, settings] =
    await Promise.all([
      // L'idioma va fins al càlcul: l'etiqueta del descompte es formata allà.
      // I el clientId també: aquí qui mira és qui comprarà, així que les ofertes
      // segmentades que l'abastin li han de sortir.
      getEffectivePrices(services, { locale, clientId: client?.id }),
      rewardPromise,
      getColorPalette(),
      getCenterSettings(),
    ]);

  // El camp de canvi surt si el centre ven vals O si en queda algun de venut
  // sense bescanviar. Apagar la venda no pot deixar sense sortida algú que ja
  // ha pagat un regal; i un centre que no els ha fet servir mai no ha de
  // carregar amb un camp que no li diu res.
  const t = await getTranslations("bonos");
  const BONO_TABS = [
    { href: "/client/bonos", label: t("tabBuy"), accent: true },
    { href: "/client/bonos/meus", label: t("tabMine") },
  ];

  const showRedeem =
    settings.giftVouchersEnabled || (await hasOutstandingGiftVouchers());
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">{t("title")}</h1>
      <RouteTabs tabs={BONO_TABS} />
      <p className="mb-6 text-sm text-brand-muted">
        {t("buy.intro")}
      </p>

      {/*
        El canvi d'un val viu aquí i no a la llista, com abans, per dues raons.
        La primera és que hi ha correus de regal JA ENVIATS amb un botó
        "Bescanviar el regal" que apunta a /client/bonos: si el camp es quedés a
        la llista, aquells botons portarien a una pantalla sense on escriure el
        codi. La segona és que "tinc un codi" i "vull sessions" són la mateixa
        intenció, i amagat sota la llista costava de trobar.
      */}
      {showRedeem && (
        <div className="mb-6">
          <RedeemGiftVoucher />
        </div>
      )}

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
          className={`mt-8 flex items-center gap-4 rounded-2xl border border-brand-border bg-white p-4 hover:border-brand-orange active:bg-brand-bg ${TAP_SURFACE}`}
        >
          <span
            aria-hidden
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange"
          >
            <Gift className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold text-brand-dark">
              {t("buy.giftCtaTitle")}
            </span>
            <span className="text-xs text-brand-muted">
              {t("buy.giftCtaDesc")}
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
