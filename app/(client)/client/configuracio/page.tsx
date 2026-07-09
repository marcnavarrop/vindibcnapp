import { getViewer } from "@/lib/auth";
import { getProfileSettings } from "@/lib/data/clients";
import { getConsentStatus } from "@/lib/data/consents";
import { ProfileSettingsForm } from "@/components/forms/profile-settings-form";
import { HealthConsentForm } from "@/components/forms/health-consent-form";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ClientConfigPage() {
  const viewer = await getViewer();
  const [settings, consent] = await Promise.all([
    viewer ? getProfileSettings(viewer.id) : Promise.resolve(null),
    viewer
      ? getConsentStatus(viewer.id)
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Configuració</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Gestiona les teves dades i preferències.
      </p>

      {settings ? (
        <ProfileSettingsForm settings={settings} />
      ) : (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          No s&apos;ha pogut carregar el teu perfil.
        </p>
      )}

      {consent && (
        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
          <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
            Privacitat i consentiments
          </h2>

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
      )}
    </main>
  );
}
