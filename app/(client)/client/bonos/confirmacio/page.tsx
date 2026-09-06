import { TAP } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { getBonoByStripeSession } from "@/lib/data/bonos";
import { getSubscriptionByCheckoutSession } from "@/lib/data/stripe-checkout";
import { formatDate } from "@/lib/labels";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { AwaitingPayment } from "@/components/ui/awaiting-payment";
import { RouteTabs } from "@/components/ui/route-tabs";
import { formatEur } from "@/lib/labels";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/**
 * Tornada del pagament amb targeta.
 *
 * Aquesta pàgina NO crea res: només mira si el webhook ja ho ha creat. És la
 * diferència entre confiar en Stripe i confiar en una redirecció que qualsevol
 * pot escriure a la barra d'adreces.
 *
 * HI ATERREN DUES COMPRES DIFERENTS i cadascuna es busca com toca:
 *
 *   · Un bo solt neix de la sessió de Checkout i en porta l'identificador, així
 *     que es troba amb `getBonoByStripeSession`.
 *   · Una SUBSCRIPCIÓ no. El seu bo el crea `invoice.paid` i porta
 *     `stripe_invoice_id`; `stripe_checkout_session_id` es queda NUL per
 *     disseny. Buscant-lo per la sessió no es trobava mai i la pantalla es
 *     quedava girant per sempre amb el pagament ja fet. El pont és la pròpia
 *     sessió, que sap quina subscripció ha creat.
 */
export default async function BonoCheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/client/bonos/meus");

  const [t, tl] = await Promise.all([
    getTranslations("bonos"),
    getTranslations("labels.service"),
  ]);
  const locale = (await getLocale()) as Locale;
  const BONO_TABS = [
    { href: "/client/bonos", label: t("tabBuy"), accent: true },
    { href: "/client/bonos/meus", label: t("tabMine") },
  ];

  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const bono = await getBonoByStripeSession(sessionId);

  // Només es pregunta per la subscripció si no hi ha bo: una compra solta no ha
  // de pagar una crida a Stripe que no necessita.
  const subscription = bono ? null : await getSubscriptionByCheckoutSession(sessionId);

  // Ha de ser d'aquest client, tant si és un bo com si és una subscripció. Sense
  // això, un session_id endevinat o reenviat ensenyaria la compra d'algú altre.
  const mine = bono && client && bono.clientId === client.id;
  const mySubscription =
    subscription && client && subscription.clientId === client.id
      ? subscription
      : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">{t("title")}</h1>
      <RouteTabs tabs={BONO_TABS} />

      {mySubscription ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center">
          <AnimatedFeedback type="success" />
          <p className="text-xl font-bold text-success">
            {t("confirmed.subscriptionTitle")}
          </p>
          <p className="max-w-sm text-sm text-brand-muted">
            {t("confirmed.subscriptionBody")}
          </p>

          <div className="mt-2 rounded-xl bg-brand-bg px-4 py-3 text-sm">
            <p className="font-bold text-brand-dark">{mySubscription.packageName}</p>
            <p className="mt-0.5 text-brand-muted">
              {t("confirmed.sessionsPrice", {
                sessions: mySubscription.sessionsPerCycle,
                price: formatEur(mySubscription.unitPrice, locale),
              })}
            </p>
            {mySubscription.nextRenewalOn && (
              <p className="mt-0.5 text-brand-muted">
                {t("confirmed.subscriptionRenews", {
                  date: formatDate(mySubscription.nextRenewalOn, locale),
                })}
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/client/reservas"
              className={`inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
            >
              {t("confirmed.book")}
            </Link>
            <Link
              href="/client/bonos/meus"
              className={`inline-flex rounded-lg border border-brand-border px-4 py-2 text-sm font-bold text-brand-dark hover:border-brand-purple hover:text-brand-purple active:bg-brand-bg ${TAP}`}
            >
              {t("confirmed.seeMine")}
            </Link>
          </div>
        </div>
      ) : !mine ? (
        <AwaitingPayment
          fallbackHref="/client/bonos/meus"
          fallbackLabel={t("confirmed.seeMine")}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center">
          <AnimatedFeedback type="success" />
          <p className="text-xl font-bold text-success">{t("confirmed.title")}</p>
          <p className="max-w-sm text-sm text-brand-muted">
            {t("confirmed.body")}
          </p>

          <div className="mt-2 rounded-xl bg-brand-bg px-4 py-3 text-sm">
            <p className="font-bold text-brand-dark">
              {tl(bono.serviceType)}
            </p>
            <p className="mt-0.5 text-brand-muted">
              {t("confirmed.sessionsPrice", { sessions: bono.totalSessions, price: formatEur(bono.price, locale) })}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/client/reservas"
              className={`inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
            >
              {t("confirmed.book")}
            </Link>
            <Link
              href="/client/bonos/meus"
              className={`inline-flex rounded-lg border border-brand-border px-4 py-2 text-sm font-bold text-brand-dark hover:border-brand-purple hover:text-brand-purple active:bg-brand-bg ${TAP}`}
            >
              {t("confirmed.seeMine")}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
