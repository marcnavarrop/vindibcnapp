import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { Badge } from "@/components/ui/badge";
import { RouteTabs } from "@/components/ui/route-tabs";
import { formatEur, formatDate } from "@/lib/labels";
import { getCycleBono, getLiveSubscription } from "@/lib/data/subscriptions";
import { SubscriptionManage } from "@/components/forms/subscription-manage";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function ClientBonosPage() {
  const [t, tl, tb, tpm, tp, tsub, viewer] = await Promise.all([
    getTranslations("bonos"),
    getTranslations("labels.service"),
    getTranslations("labels.bonoStatus"),
    getTranslations("labels.paymentMethod"),
    getTranslations("picker"),
    getTranslations("labels.subscriptionStatus"),
    getViewer(),
  ]);
  const locale = (await getLocale()) as Locale;
  const client = viewer ? await getClientByProfile(viewer.id) : null;

  // La subscripció i el bo del mes en curs. Es demanen en sèrie perquè el segon
  // necessita l'identificador del primer, i només si n'hi ha.
  const subscription = client ? await getLiveSubscription(client.id) : null;
  const cycleBono = subscription
    ? await getCycleBono(subscription.id, subscription.currentCycleStart)
    : null;
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
          {/* La subscripció va a dalt de tot i no barrejada amb els bons: el que
              hi ha aquí no és una compra sinó el que passarà cada mes, i és el
              primer que vol saber qui en té una. */}
          {subscription && (
            <Panel title={t("mine.subscriptionTitle")}>
              <Row>
                <span className="font-bold text-brand-dark">
                  {subscription.packageName}
                </span>
                <span>
                  {t("mine.subscriptionPerMonth", {
                    price: formatEur(subscription.unitPrice, locale),
                  })}
                </span>
                {subscription.nextRenewalOn && (
                  <span className="text-brand-muted">
                    {t("mine.subscriptionRenewsOn", {
                      date: formatDate(subscription.nextRenewalOn, locale),
                    })}
                  </span>
                )}
                <span className="text-brand-muted">
                  {subscription.paymentMethod === "card"
                    ? t("mine.subscriptionByCard")
                    : t("mine.subscriptionByCentre")}
                </span>
                <Badge tone={subscription.status === "active" ? "success" : "warn"}>
                  {tsub(subscription.status)}
                </Badge>
              </Row>

              {cycleBono ? (
                <Row>
                  <span className="text-brand-muted">
                    {t("mine.subscriptionCycleSessions", {
                      remaining: cycleBono.remainingSessions,
                      total: cycleBono.totalSessions,
                    })}
                  </span>
                  {cycleBono.expiresAt && (
                    <span className="text-brand-muted">
                      {t("mine.subscriptionCycleEnds", {
                        date: formatDate(cycleBono.expiresAt, locale),
                      })}
                    </span>
                  )}
                </Row>
              ) : (
                <Empty>{t("mine.subscriptionNoCycle")}</Empty>
              )}

              {subscription.cancelAtPeriodEnd && (
                <Row>
                  <span className="text-brand-muted">
                    {t("mine.subscriptionEndsAfterCycle")}
                  </span>
                </Row>
              )}

              {/* Dos avisos i no un: deure el mes en curs encara té arreglo
                  abans de la renovació; estar aturada vol dir que ja ha passat.
                  Dir-ho igual seria enganyar en un dels dos casos. */}
              {subscription.status === "past_due" ? (
                <Row>
                  <span className="text-error">{t("mine.subscriptionPastDue")}</span>
                </Row>
              ) : (
                cycleBono?.status === "pending_payment" && (
                  <Row>
                    <span className="text-brand-muted">
                      {t("mine.subscriptionPending")}
                    </span>
                  </Row>
                )
              )}

              <SubscriptionManage
                byCard={subscription.paymentMethod === "card"}
                cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
              />
            </Panel>
          )}

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
