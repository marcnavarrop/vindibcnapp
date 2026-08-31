import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { stripeEnabled } from "@/lib/stripe";
import { getClientByProfile } from "@/lib/data/clients";
import { listGiftVouchersBought } from "@/lib/data/gift-vouchers";
import { GiftVoucherForm } from "@/components/forms/gift-voucher-form";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEur } from "@/lib/labels";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function RegalsPage() {
  const [t, tg] = await Promise.all([
    getTranslations("gifts"),
    getTranslations("labels.giftVoucherStatus"),
  ]);
  const locale = (await getLocale()) as Locale;
  const viewer = await getViewer();

  // El toggle es comprova al servidor i respon 404, com els altres mòduls
  // opcionals: amagar la targeta del panell no impedeix escriure l'URL.
  const settings = await getCenterSettings();
  if (!settings.giftVouchersEnabled) notFound();

  const servicesPromise = listActiveServices();
  const clientPromise = viewer
    ? getClientByProfile(viewer.id)
    : Promise.resolve(null);

  const services = await servicesPromise;
  const [effectivePricesMap, palette, client] = await Promise.all([
    // L'idioma va fins al càlcul: l'etiqueta del descompte es formata allà.
    getEffectivePrices(services, undefined, locale),
    getColorPalette(),
    clientPromise,
  ]);
  const bought = client ? await listGiftVouchersBought(client.id) : [];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mb-6 text-sm text-brand-muted">
        {t("intro")}
      </p>

      <GiftVoucherForm
        services={services}
        palette={palette}
        effectivePrices={Object.fromEntries(effectivePricesMap)}
        stripeEnabled={stripeEnabled()}
      />

      {bought.length > 0 && (
        <section className="mt-10 overflow-hidden rounded-2xl border border-brand-border bg-white">
          <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
            {t("historyTitle")}
          </h2>
          <div className="divide-y divide-brand-border">
            {bought.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
              >
                <span className="font-mono font-bold text-brand-purple">
                  {v.code}
                </span>
                <span className="text-brand-dark">{v.packageName}</span>
                <span className="text-brand-muted">{formatEur(v.price, locale)}</span>
                <Badge
                  tone={
                    v.status === "active"
                      ? "success"
                      : v.status === "pending_payment"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {tg(v.status)}
                </Badge>
                <span className="text-xs text-brand-muted">
                  {v.status === "redeemed" && v.redeemedAt
                    ? t("redeemedOn", { date: formatDate(v.redeemedAt, locale) })
                    : t("validThrough", { date: formatDate(v.expiresAt, locale) })}
                </span>
                {v.pdfPath && (
                  <a
                    href={`/client/regals/${v.id}/pdf`}
                    className="ml-auto text-xs font-bold text-brand-purple hover:text-brand-orange"
                  >
                    {t("historyDownload")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
