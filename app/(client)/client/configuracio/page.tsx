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
import type { ConsentStatus } from "@/lib/data/consents";

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

  const tabs = [
    {
      label: "Dades personals",
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
              Preferències
            </h2>
            <LanguageSwitcher current={locale} label="Idioma" />
          </section>

          {settings ? (
            <ProfileSettingsForm settings={settings} />
          ) : (
            <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
              No s&apos;ha pogut carregar el teu perfil.
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
      label: "Privacitat",
      content: consent ? (
        <PrivacySection consent={consent} />
      ) : (
        <p className="text-sm text-brand-muted">No disponible.</p>
      ),
    },
    {
      label: "Notificacions",
      content: prefs ? (
        <NotificationPreferencesForm prefs={prefs} role="client" />
      ) : (
        <p className="text-sm text-brand-muted">No disponible.</p>
      ),
    },
    ...(!USE_MOCK
      ? [{ label: "Contrasenya", content: <ChangePasswordForm /> }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Configuració</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Gestiona les teves dades i preferències.
      </p>
      <InPageTabs tabs={tabs} />
    </main>
  );
}

function PrivacySection({ consent }: { consent: ConsentStatus }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-bold text-brand-dark">
          Política de Privacitat i Avís Legal
        </span>
        <span className="text-brand-muted">
          {consent.privacyAt
            ? `Acceptats el ${formatDate(consent.privacyAt)} (versió ${consent.privacyVersion}).`
            : "Encara no consta cap acceptació registrada."}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-brand-border pt-4 text-sm">
        <span className="font-bold text-brand-dark">Dades de salut</span>
        {consent.healthDataAt ? (
          <span className="text-brand-muted">
            Consentiment donat el {formatDate(consent.healthDataAt)}. Pots
            revocar-lo escrivint al centre.
          </span>
        ) : (
          <>
            <span className="text-brand-muted">
              Si reps fisioteràpia, necessitem el teu consentiment per tractar
              les teves dades de salut.
            </span>
            <HealthConsentForm />
          </>
        )}
      </div>
    </section>
  );
}
