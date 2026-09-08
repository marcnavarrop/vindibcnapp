import { getViewer } from "@/lib/auth";
import { getPreferences } from "@/lib/notifications/preferences";
import { getCenterSettings } from "@/lib/data/center-settings";
import { NotificationPreferencesForm } from "@/components/forms/notification-preferences-form";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { CenterSettingsForm } from "@/components/forms/center-settings-form";
import { ColorsForm } from "@/components/forms/colors-form";
import { CenterCatalog } from "@/components/forms/center-catalog";
import { getColorPalette } from "@/lib/data/colors";
import { listCenters } from "@/lib/data/centers";
import {
  createCenterAction,
  renameCenterAction,
} from "@/lib/actions/centers-registry";
import { listTrainersDetailed } from "@/lib/data/trainers";
import { avatarUrls } from "@/lib/data/avatars";
import { InPageTabs } from "@/components/ui/in-page-tabs";
import { USE_MOCK } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const viewer = await getViewer();
  const [prefs, centerSettings, palette, trainers, centers] = await Promise.all([
    viewer ? getPreferences(viewer.id) : Promise.resolve(null),
    getCenterSettings(),
    getColorPalette(),
    listTrainersDetailed(),
    listCenters(),
  ]);
  const avatars = await avatarUrls(trainers.map((t) => t.avatarPath));
  const professionals = trainers.map((t) => ({
    id: t.id,
    name: t.fullName,
    avatarUrl: avatars.get(t.avatarPath ?? "") ?? null,
  }));

  const tabs = [
    {
      label: "Centre",
      content: <CenterSettingsForm settings={centerSettings} />,
    },
    /*
      Va just després de "Centre" perquè són veïns de tema, i es diu "Registre
      de centres" i no "Centres" perquè dues pestanyes de costat que es
      diferenciïn per una essa no les distingeix ningú. I són coses ben
      diferents: "Centre" són els AJUSTOS d'aquest centre —horaris, política de
      cancel·lació—, que viuen a `center_settings` i són globals; això és la
      llista de NOMS de la 0080, que encara no governa res.
    */
    {
      label: "Registre de centres",
      content: (
        <CenterCatalog
          centers={centers}
          createAction={createCenterAction}
          renameAction={renameCenterAction}
        />
      ),
    },
    {
      label: "Colors",
      content: (
        <ColorsForm palette={palette} professionals={professionals} />
      ),
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
