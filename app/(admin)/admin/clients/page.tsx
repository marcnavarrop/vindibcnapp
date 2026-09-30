import Link from "next/link";
import { TAP } from "@/lib/utils";
import { ClientsTable } from "@/components/clients-table";
import { listClientsPage } from "@/lib/data/clients";
import { getTrainer } from "@/lib/data/trainers";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/entrenadors", label: "Professionals" },
];

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ trainer?: string; q?: string }>;
}) {
  const { trainer, q: rawQ } = await searchParams;
  const trainerId = trainer || null;
  const q = (rawQ ?? "").trim().slice(0, 60);

  // La cerca i el filtre per entrenador es resolen al servidor. El filtre va
  // per id, per no confondre dos entrenadors que es diguin igual.
  const [page, trainerRow] = await Promise.all([
    listClientsPage({ q, trainerId }),
    trainerId ? getTrainer(trainerId) : null,
  ]);

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
            >
              ← Tornar
            </Link>
            <h1 className="mt-1 text-2xl text-brand-dark">Clients</h1>
          </div>
          <Link
            href="/admin/clients/new"
            className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            + Nou client
          </Link>
        </div>

        <ClientsTable
          initialRows={page.items}
          initialCursor={page.nextCursor}
          total={page.total}
          q={q}
          trainerId={trainerId}
          trainerFilter={trainerId ? { name: trainerRow?.fullName ?? null } : null}
        />
      </main>
    </>
  );
}
