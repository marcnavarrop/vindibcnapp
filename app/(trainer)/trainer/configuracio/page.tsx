import { getViewer } from "@/lib/auth";
import { getPreferences } from "@/lib/notifications/preferences";
import { NotificationPreferencesForm } from "@/components/forms/notification-preferences-form";

export const dynamic = "force-dynamic";

export default async function TrainerConfigPage() {
  const viewer = await getViewer();
  const prefs = viewer ? await getPreferences(viewer.id) : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Configuració</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Gestiona com vols rebre els avisos del centre.
      </p>
      {prefs && <NotificationPreferencesForm prefs={prefs} role="trainer" />}
    </main>
  );
}
