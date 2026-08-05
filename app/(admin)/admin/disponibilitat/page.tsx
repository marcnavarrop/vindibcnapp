import { centerToday } from "@/lib/center-time";
import Link from "next/link";
import { getCenterSettings } from "@/lib/data/center-settings";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/reservas", label: "Reserves" },
  { href: "/admin/disponibilitat", label: "Disponibilitat" },
  { href: "/admin/prova", label: "Sessions de prova" },
];
import { listTrainersDetailed } from "@/lib/data/trainers";
import { listAvailabilityRules } from "@/lib/data/availability";
import { listUpcomingBlocks } from "@/lib/data/availability-blocks";
import { AvailabilityManager } from "@/components/availability-manager";
import { AvailabilityBlocksManager } from "@/components/availability-blocks-manager";
import {
  createAvailabilityAdminAction,
  updateAvailabilityAdminAction,
  deleteAvailabilityAdminAction,
  createBlockAdminAction,
  deleteBlockAdminAction,
} from "@/app/(admin)/admin/disponibilitat/actions";
import { clsx } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDisponibilitatPage({
  searchParams,
}: {
  searchParams: Promise<{ trainer?: string }>;
}) {
  const { trainer: selectedId } = await searchParams;
  const trainers = await listTrainersDetailed();
  const selected =
    trainers.find((t) => t.id === selectedId) ?? trainers[0] ?? null;
  const centerSettings = await getCenterSettings();
  const [rules, blocks] = selected
    ? await Promise.all([
        listAvailabilityRules(selected.id),
        listUpcomingBlocks(selected.id),
      ])
    : [[], []];
  const todayStr = centerToday();

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Disponibilitat</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Gestiona els horaris de cada professional.
      </p>

      {trainers.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          No hi ha professionals.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {trainers.map((t) => (
              <Link
                key={t.id}
                href={`/admin/disponibilitat?trainer=${t.id}`}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors",
                  selected?.id === t.id
                    ? "border-brand-purple bg-brand-purple text-white"
                    : "border-brand-border bg-white text-brand-muted hover:text-brand-dark",
                )}
              >
                {t.fullName}
              </Link>
            ))}
          </div>

          {selected && (
            <AvailabilityManager
              rules={rules}
              todayStr={todayStr}
              specialty={selected.specialty}
              createAction={createAvailabilityAdminAction.bind(null, selected.id)}
              updateAction={updateAvailabilityAdminAction}
              deleteAction={deleteAvailabilityAdminAction}
            />
          )}

          {selected && (
            <AvailabilityBlocksManager
              blocks={blocks}
              openingHour={centerSettings.openingHour}
              closingHour={centerSettings.closingHour}
              createAction={createBlockAdminAction.bind(null, selected.id)}
              deleteAction={deleteBlockAdminAction}
            />
          )}
        </>
      )}
    </main>
    </>
  );
}
