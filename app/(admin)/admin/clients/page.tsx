import Link from "next/link";
import { ClientsTable } from "@/components/clients-table";
import { listClients } from "@/lib/data/clients";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/entrenadors", label: "Entrenadors" },
];

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClients();

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
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nou client
          </Link>
        </div>

        <ClientsTable clients={clients} />
      </main>
    </>
  );
}
