import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { Badge } from "@/components/ui/badge";
import { RouteTabs } from "@/components/ui/route-tabs";
import { formatEur, formatDate } from "@/lib/labels";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function ClientBonosPage() {
  const [t, tl, tb, tpm, tp, viewer] = await Promise.all([
    getTranslations("bonos"),
    getTranslations("labels.service"),
    getTranslations("labels.bonoStatus"),
    getTranslations("labels.paymentMethod"),
    getTranslations("picker"),
    getViewer(),
  ]);
  const locale = (await getLocale()) as Locale;
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const BONO_TABS = [
    { href: "/client/bonos", label: t("tabBuy"), accent: true },
    { href: "/client/bonos/meus", label: t("tabMine") },
  ];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">{t("title")}</h1>
      <RouteTabs tabs={BONO_TABS} />

      {!client ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          {t("mine.noClientRecord")}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <Panel title={t("mine.title")}>
            {client.bonos.length === 0 ? (
              <Empty>{t("mine.empty")}</Empty>
            ) : (
              client.bonos.map((b) => (
                <Row key={b.id}>
                  <span className="font-bold text-brand-dark">
                    {tl(b.serviceType)}
                  </span>
                  <span className="text-brand-muted">
                    {t("mine.sessionsOf", { remaining: b.remainingSessions, total: b.totalSessions })}
                  </span>
                  <span>{formatEur(b.price, locale)}</span>
                  <Badge
                    tone={
                      b.status === "active"
                        ? "success"
                        : b.status === "pending_payment"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {tb(b.status)}
                  </Badge>
                </Row>
              ))
            )}
          </Panel>

          <Panel title={t("mine.payments")}>
            {client.payments.length === 0 ? (
              <Empty>{t("mine.noPayments")}</Empty>
            ) : (
              client.payments.map((p) => (
                <Row key={p.id}>
                  <span className="font-bold text-brand-dark">
                    {formatDate(p.paidAt, locale)}
                  </span>
                  <span className="font-bold">{formatEur(p.amount, locale)}</span>
                  <Badge tone={p.method === "card" ? "info" : "warn"}>
                    {tpm(p.method)}
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
