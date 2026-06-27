import Link from "next/link";
import { listTrainersDetailed } from "@/lib/data/trainers";
import { listAvailabilityRules } from "@/lib/data/availability";
import { AvailabilityManager } from "@/components/availability-manager";
import {
  createAvailabilityAdminAction,
  updateAvailabilityAdminAction,
  deleteAvailabilityAdminAction,
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
  const rules = selected ? await listAvailabilityRules(selected.id) : [];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Disponibilitat</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Gestiona els horaris de cada entrenador/a.
      </p>

      {trainers.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          No hi ha entrenadors.
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
              createAction={createAvailabilityAdminAction.bind(null, selected.id)}
              updateAction={updateAvailabilityAdminAction}
              deleteAction={deleteAvailabilityAdminAction}
            />
          )}
        </>
      )}
    </main>
  );
}
