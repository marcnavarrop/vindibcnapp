import { getViewer } from "@/lib/auth";
import { getPreferences } from "@/lib/notifications/preferences";
import { getCenterSettings } from "@/lib/data/center-settings";
import { NotificationPreferencesForm } from "@/components/forms/notification-preferences-form";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { CenterSettingsForm } from "@/components/forms/center-settings-form";
import { InPageTabs } from "@/components/ui/in-page-tabs";
import { USE_MOCK } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const viewer = await getViewer();
  const [prefs, centerSettings] = await Promise.all([
    viewer ? getPreferences(viewer.id) : Promise.resolve(null),
    getCenterSettings(),
  ]);

  const tabs = [
    {
      label: "Centre",
      content: <CenterSettingsForm settings={centerSettings} />,
    },
    {
      label: "Notificacions",
      content: prefs ? (
        <NotificationPreferencesForm prefs={prefs} role="admin" />
      ) : (
        <p className="text-sm text-brand-muted">No disponible.</p>
      ),
    },
    ...(!USE_MOCK
      ? [{ label: "Seguretat", content: <ChangePasswordForm /> }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl text-brand-dark">Configuració</h1>
      <InPageTabs tabs={tabs} />
    </main>
  );
}
