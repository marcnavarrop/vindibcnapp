import { getViewer } from "@/lib/auth";
import { getPreferences } from "@/lib/notifications/preferences";
import { getCenterSettings } from "@/lib/data/center-settings";
import { NotificationPreferencesForm } from "@/components/forms/notification-preferences-form";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { CenterSettingsForm } from "@/components/forms/center-settings-form";
import { USE_MOCK } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const viewer = await getViewer();
  const [prefs, centerSettings] = await Promise.all([
    viewer ? getPreferences(viewer.id) : Promise.resolve(null),
    getCenterSettings(),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl text-brand-dark">Configuració</h1>

      <section className="mb-8">
        <h2 className="mb-1 text-base font-bold text-brand-dark">
          Configuració del centre
        </h2>
        <p className="mb-4 text-sm text-brand-muted">
          Paràmetres globals que afecten el comportament de l&apos;app per a
          tots els clients.
        </p>
        <CenterSettingsForm settings={centerSettings} />
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-base font-bold text-brand-dark">
          Notificacions
        </h2>
        <p className="mb-4 text-sm text-brand-muted">
          Gestiona com vols rebre els avisos de gestió del centre.
        </p>
        {prefs && <NotificationPreferencesForm prefs={prefs} role="admin" />}
      </section>

      {!USE_MOCK && (
        <section>
          <h2 className="mb-4 text-base font-bold text-brand-dark">
            Seguretat
          </h2>
          <ChangePasswordForm />
        </section>
      )}
    </main>
  );
}
