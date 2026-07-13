import { getViewer } from "@/lib/auth";
import { listAvailabilityRules } from "@/lib/data/availability";
import { AvailabilityManager } from "@/components/availability-manager";
import {
  createAvailabilityTrainerAction,
  updateAvailabilityTrainerAction,
  deleteAvailabilityTrainerAction,
} from "@/app/(trainer)/trainer/disponibilitat/actions";

export const dynamic = "force-dynamic";

export default async function TrainerDisponibilitatPage() {
  const viewer = await getViewer();
  const rules = viewer ? await listAvailabilityRules(viewer.id) : [];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
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
    </main>
  );
}
