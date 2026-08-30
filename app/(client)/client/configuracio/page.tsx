import { getViewer } from "@/lib/auth";
import { getProfileSettings } from "@/lib/data/clients";
import { getConsentStatus } from "@/lib/data/consents";
import { getPreferences } from "@/lib/notifications/preferences";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getReferralStats } from "@/lib/data/referral";
import { ProfileSettingsForm } from "@/components/forms/profile-settings-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { resolveLocale } from "@/lib/i18n/resolve";
import { HealthConsentForm } from "@/components/forms/health-consent-form";
import { NotificationPreferencesForm } from "@/components/forms/notification-preferences-form";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { ReferralCodeCard } from "@/components/referral-code-card";
import { InPageTabs } from "@/components/ui/in-page-tabs";
import { USE_MOCK } from "@/lib/config";
import { formatDate } from "@/lib/labels";
import { getTranslations } from "next-intl/server";
import type { ConsentStatus } from "@/lib/data/consents";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function ClientConfigPage() {
  const viewer = await getViewer();
  const [settings, consent, prefs, centerSettings, referralStats, locale] =
    await Promise.all([
      viewer ? getProfileSettings(viewer.id) : Promise.resolve(null),
      viewer ? getConsentStatus(viewer.id) : Promise.resolve(null),
      viewer ? getPreferences(viewer.id) : Promise.resolve(null),
      getCenterSettings(),
      viewer ? getReferralStats(viewer.id) : Promise.resolve(null),
      resolveLocale(),
    ]);
  const t = await getTranslations("config");

  const tabs = [
    {
      label: t("tabs.personal"),
      content: (
        <div className="flex flex-col gap-4">
          {/*
            L'idioma va FORA del formulari de dades personals: es desa sol en
            triar-lo i té efecte immediat, mentre que la resta del formulari
            espera el botó de desar. Dins hi semblava un camp més d'un
            formulari que cal enviar, i a més el canvi es perdia.

            El valor que ensenya és l'ACTIU (la cookie), no el del perfil: si
            divergissin, el desplegable diria una cosa i la pantalla una altra.
          */}
          <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
            <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
              {t("prefs.title")}
            </h2>
            <LanguageSwitcher current={locale} label={t("prefs.language")} />
          </section>

          {settings ? (
            <ProfileSettingsForm settings={settings} />
          ) : (
            <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
              {t("profileUnavailable")}
            </p>
          )}
          {centerSettings.referralProgramActive && referralStats && (
            <ReferralCodeCard
              code={referralStats.code}
              referredCount={referralStats.referredCount}
              discountPercent={centerSettings.referralDiscountPercent}
            />
          )}
        </div>
      ),
    },
    {
      label: t("tabs.privacy"),
      content: consent ? (
        <PrivacySection consent={consent} locale={locale} />
      ) : (
        <p className="text-sm text-brand-muted">{t("unavailable")}</p>
      ),
    },
    {
      label: t("tabs.notifications"),
      content: prefs ? (
        <NotificationPreferencesForm prefs={prefs} role="client" />
      ) : (
        <p className="text-sm text-brand-muted">{t("unavailable")}</p>
      ),
    },
    ...(!USE_MOCK
      ? [{ label: t("tabs.password"), content: <ChangePasswordForm translated /> }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mb-6 text-sm text-brand-muted">{t("intro")}</p>
      <InPageTabs tabs={tabs} ariaLabel={t("sections")} />
    </main>
  );
}

async function PrivacySection({
  consent,
  locale,
}: {
  consent: ConsentStatus;
  locale: Locale;
}) {
  const t = await getTranslations("config.privacy");
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-bold text-brand-dark">
          {t("legalTitle")}
        </span>
        <span className="text-brand-muted">
          {consent.privacyAt
            ? t("accepted", {
                date: formatDate(consent.privacyAt, locale),
                // Sense versió la frase deia "(versió null)". No hauria de
                // passar —la data i la versió venen de la mateixa fila— però
                // val més un guionet que ensenyar un null.
                version: consent.privacyVersion ?? "—",
              })
            : t("none")}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-brand-border pt-4 text-sm">
        <span className="font-bold text-brand-dark">{t("healthTitle")}</span>
        {consent.healthDataAt ? (
          <span className="text-brand-muted">
            {t("healthGiven", {
              date: formatDate(consent.healthDataAt, locale),
            })}
          </span>
        ) : (
          <>
            <span className="text-brand-muted">
              {t("healthAsk")}
            </span>
            <HealthConsentForm />
          </>
        )}
      </div>
    </section>
  );
}
