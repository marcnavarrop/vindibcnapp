import { getViewer } from "@/lib/auth";
import { getProfileSettings } from "@/lib/data/clients";
import { ProfileSettingsForm } from "@/components/forms/profile-settings-form";

export const dynamic = "force-dynamic";

export default async function ClientConfigPage() {
  const viewer = await getViewer();
  const settings = viewer ? await getProfileSettings(viewer.id) : null;

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
    </main>
  );
}
