import Link from "next/link";
import { listBonos } from "@/lib/data/bonos";
import { BonosAdminTable } from "@/components/bonos-admin-table";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/bonos", label: "Bons" },
  { href: "/admin/pagos", label: "Pagaments" },
];

export const dynamic = "force-dynamic";

export default async function BonosPage() {
  const bonos = await listBonos();

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Bons</h1>

        <BonosAdminTable bonos={bonos} />
      </main>
    </>
  );
}
