import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { Badge } from "@/components/ui/badge";
import { RouteTabs } from "@/components/ui/route-tabs";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatEur,
  formatDate,
} from "@/lib/labels";

const BONO_TABS = [
  { href: "/client/bonos", label: "Els meus bons" },
  { href: "/client/bonos/comprar", label: "Comprar bo nou", accent: true },
];

export const dynamic = "force-dynamic";

export default async function ClientBonosPage() {
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">Bonos</h1>
      <RouteTabs tabs={BONO_TABS} />

      {!client ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no tens fitxa de client.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <Panel title="Els meus bons">
            {client.bonos.length === 0 ? (
              <Empty>Encara no tens cap bo.</Empty>
            ) : (
              client.bonos.map((b) => (
                <Row key={b.id}>
                  <span className="font-bold text-brand-dark">
                    {SERVICE_LABELS[b.serviceType]}
                  </span>
                  <span className="text-brand-muted">
                    {b.remainingSessions} / {b.totalSessions} sessions
                  </span>
                  <span>{formatEur(b.price)}</span>
                  <Badge
                    tone={
                      b.status === "active"
                        ? "success"
                        : b.status === "pending_payment"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {BONO_STATUS_LABELS[b.status]}
                  </Badge>
                </Row>
              ))
            )}
          </Panel>

          <Panel title="Historial de pagaments">
            {client.payments.length === 0 ? (
              <Empty>Encara no hi ha pagaments.</Empty>
            ) : (
              client.payments.map((p) => (
                <Row key={p.id}>
                  <span className="font-bold text-brand-dark">
                    {formatDate(p.paidAt)}
                  </span>
                  <span className="font-bold">{formatEur(p.amount)}</span>
                  <Badge tone={p.method === "card" ? "info" : "warn"}>
                    {PAYMENT_METHOD_LABELS[p.method]}
                  </Badge>
                </Row>
              ))
            )}
          </Panel>
        </div>
      )}
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
        {title}
      </h2>
      <div className="divide-y divide-brand-border">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-3 text-sm text-brand-muted">{children}</p>;
}
