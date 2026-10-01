import Link from "next/link";
import {
  listPendingTrialRequests,
  listTrialHistoryPage,
  PENDING_TRIALS_LIMIT,
} from "@/lib/data/trial-bookings";
import { GroupTabs } from "@/components/ui/group-tabs";
import { TrialHistory, TrialRow } from "@/components/admin/trial-rows";
import { toTrialRowView } from "@/lib/trial-row";
import { assertModuleEnabled } from "@/lib/data/module-guard";
import { TAP } from "@/lib/utils";

const TABS = [
  { href: "/admin/reservas", label: "Reserves" },
  { href: "/admin/disponibilitat", label: "Disponibilitat" },
  { href: "/admin/prova", label: "Sessions de prova" },
];

export const dynamic = "force-dynamic";

export default async function AdminProvaPage() {
  await assertModuleEnabled("sessionsProva");
  // L'històric primer: escombra les pendents ja caducades. Les pendents tenen
  // la seva consulta, que també mira la data i no depèn de l'escombrat.
  // Abans sortien totes dues d'una sola llista sense límit, per data
  // ascendent: al tall de 1000, les primeres a caure eren les més noves.
  const history = await listTrialHistoryPage({});
  const pending = await listPendingTrialRequests();

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
      <Link
        href="/admin"
        className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
      >
        ← Tornar
      </Link>
      <h1 className="mt-1 mb-1 text-2xl text-brand-dark">Sessions de prova</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Sol·licituds de sessió de prova gratuïta. Les pendents pre-bloquegen el
        forat fins que es confirmen, es rebutgen o caduquen.
      </p>

      {pending.length === 0 && history.total === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no hi ha cap sol·licitud de prova.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {pending.length > 0 && (
            <Section title={`Pendents (${pending.length})`}>
              <div className="divide-y divide-brand-border" data-testid="trial-pending">
                {pending.map((t) => (
                  <TrialRow key={t.id} t={toTrialRowView(t)} />
                ))}
              </div>
              {pending.length >= PENDING_TRIALS_LIMIT && (
                <p className="border-t border-brand-border px-5 py-3 text-xs text-brand-muted">
                  Surten les {PENDING_TRIALS_LIMIT} que caduquen abans. Respon-les i sortiran les següents.
                </p>
              )}
            </Section>
          )}
          <Section title="Històric">
            <TrialHistory
              initialRows={history.items.map(toTrialRowView)}
              initialCursor={history.nextCursor}
              total={history.total}
            />
          </Section>
        </div>
      )}
    </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <h2 className="border-b border-brand-border bg-brand-bg px-5 py-2.5 text-sm font-bold tracking-wide text-brand-dark uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
