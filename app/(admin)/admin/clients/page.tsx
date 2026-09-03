import Link from "next/link";
import { TAP } from "@/lib/utils";
import { ClientsTable } from "@/components/clients-table";
import { listClients } from "@/lib/data/clients";
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
  searchParams: Promise<{ trainer?: string }>;
}) {
  const { trainer: trainerId } = await searchParams;

  // El filtre per entrenador es resol al servidor i per id: listClients ja
  // l'accepta, i així evitem ambigüitats si dos entrenadors es diuen igual.
  const [clients, trainer] = await Promise.all([
    listClients(trainerId),
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
              className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
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
          clients={clients}
          trainerFilter={trainerId ? { name: trainer?.fullName ?? null } : null}
        />
      </main>
    </>
  );
}
