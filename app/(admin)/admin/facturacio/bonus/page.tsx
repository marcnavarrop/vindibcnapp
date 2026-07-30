import { GroupTabs } from "@/components/ui/group-tabs";
import { FACTURACIO_TABS } from "@/app/(admin)/admin/facturacio/tabs";

export const dynamic = "force-dynamic";

export default function BonusPage() {
  return (
    <>
      <GroupTabs tabs={FACTURACIO_TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Bonus</h1>
        <div className="mt-6 rounded-2xl border border-brand-border bg-white p-8 text-center">
          <p className="text-sm font-bold tracking-wide text-brand-purple uppercase">
            Pròximament
          </p>
          <p className="mt-2 text-sm text-brand-muted">
            Sistema de bonificacions per volum de sessions.
          </p>
        </div>
      </main>
    </>
  );
}
