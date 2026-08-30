import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { getPublicTrialData } from "@/lib/data/trial-bookings";
import { TrialCalendar } from "@/components/trial-calendar";
import { requestTrialAction } from "@/app/prova/actions";
import { assertModuleEnabled } from "@/lib/data/module-guard";
import { getCenterSettings } from "@/lib/data/center-settings";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * Títol i descripció també traduïts: és el que es llegeix a la pestanya i el
 * que ensenya l'enllaç quan algú el comparteix. Mateix criteri que al login.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("trial");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ProvaPage() {
  await assertModuleEnabled("sessionsProva");
  const [data, centerSettings, locale, t] = await Promise.all([
    getPublicTrialData(),
    getCenterSettings(),
    resolveLocale(),
    getTranslations("trial"),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Wordmark height={30} />
        <div className="flex items-center gap-4">
          {/* Aquí hi arriba gent SENSE compte: si no pot triar l'idioma en
              aquesta pantalla, no el pot triar enlloc. Va a cookie, sense
              tocar cap fitxa. */}
          <LanguageSwitcher current={locale} />
          <Link
            href="/login"
            className="text-sm font-bold text-brand-muted hover:text-brand-purple"
          >
            {t("haveAccount")}
          </Link>
        </div>
      </div>

      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm text-brand-muted">{t("intro")}</p>

      <TrialCalendar
        data={data}
        action={requestTrialAction}
        openingHour={centerSettings.openingHour}
        closingHour={centerSettings.closingHour}
      />
    </main>
  );
}
