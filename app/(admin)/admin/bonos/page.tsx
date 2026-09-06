import Link from "next/link";
import { listBonos } from "@/lib/data/bonos";
import { centerToday } from "@/lib/center-time";
import { BonosAdminTable } from "@/components/bonos-admin-table";
import { GroupTabs } from "@/components/ui/group-tabs";
import { BONS_TABS } from "@/lib/admin-tabs";
import { TAP } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BonosPage() {
  const bonos = await listBonos();

  return (
    <>
      <GroupTabs tabs={BONS_TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin"
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Tornar
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Bons</h1>

        {/* El dia del CENTRE, no el del navegador: la taula l'usa per dir si
            un bo decaigut ja ha passat de data abans que l'admin el cobri. */}
        <BonosAdminTable bonos={bonos} today={centerToday()} />
      </main>
    </>
  );
}
