import { getViewer } from "@/lib/auth";
import { getCenterSettings } from "@/lib/data/center-settings";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/trainer/reservas", label: "Reserves" },
  { href: "/trainer/disponibilitat", label: "Disponibilitat" },
];
import { listAvailabilityRules } from "@/lib/data/availability";
import { listUpcomingBlocks } from "@/lib/data/availability-blocks";
import { AvailabilityManager } from "@/components/availability-manager";
import { AvailabilityBlocksManager } from "@/components/availability-blocks-manager";
import {
  createAvailabilityTrainerAction,
  updateAvailabilityTrainerAction,
  deleteAvailabilityTrainerAction,
  createBlockTrainerAction,
  deleteBlockTrainerAction,
} from "@/app/(trainer)/trainer/disponibilitat/actions";

export const dynamic = "force-dynamic";

export default async function TrainerDisponibilitatPage() {
  const viewer = await getViewer();
  const centerSettings = await getCenterSettings();
  const [rules, blocks] = viewer
    ? await Promise.all([
        listAvailabilityRules(viewer.id),
        listUpcomingBlocks(viewer.id),
      ])
    : [[], []];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Disponibilitat</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Defineix els teus horaris. Els clients només podran reservar dins
        d&apos;aquestes franjes.
      </p>

      <AvailabilityManager
        rules={rules}
        todayStr={todayStr}
        specialty={viewer?.specialty ?? null}
        createAction={createAvailabilityTrainerAction}
        updateAction={updateAvailabilityTrainerAction}
        deleteAction={deleteAvailabilityTrainerAction}
      />

      <AvailabilityBlocksManager
        blocks={blocks}
        openingHour={centerSettings.openingHour}
        closingHour={centerSettings.closingHour}
        createAction={createBlockTrainerAction}
        deleteAction={deleteBlockTrainerAction}
      />
    </main>
    </>
  );
}
