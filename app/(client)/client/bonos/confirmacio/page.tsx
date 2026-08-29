import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { getBonoByStripeSession } from "@/lib/data/bonos";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { AwaitingPayment } from "@/components/ui/awaiting-payment";
import { RouteTabs } from "@/components/ui/route-tabs";
import { SERVICE_LABELS, formatEur } from "@/lib/labels";

export const dynamic = "force-dynamic";

const BONO_TABS = [
  { href: "/client/bonos/comprar", label: "Comprar bo nou", accent: true },
  { href: "/client/bonos", label: "Els meus bons" },
];

/**
 * Tornada del pagament amb targeta.
 *
 * Aquesta pàgina NO crea el bo: només mira si el webhook ja l'ha creat. És la
 * diferència entre confiar en Stripe i confiar en una redirecció que qualsevol
 * pot escriure a la barra d'adreces.
 */
export default async function BonoCheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/client/bonos");

  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const bono = await getBonoByStripeSession(sessionId);

  // El bo ha de ser d'aquest client. Sense això, un session_id endevinat o
  // reenviat ensenyaria la compra d'algú altre.
  const mine = bono && client && bono.clientId === client.id;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl text-brand-dark">Bons</h1>
      <RouteTabs tabs={BONO_TABS} />

      {!mine ? (
        <AwaitingPayment
          fallbackHref="/client/bonos"
          fallbackLabel="Veure els meus bons"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center">
          <AnimatedFeedback type="success" />
          <p className="text-xl font-bold text-success">Pagament confirmat</p>
          <p className="max-w-sm text-sm text-brand-muted">
            El bo ja és teu i el pots fer servir per reservar ara mateix. No has
            de pagar res al centre.
          </p>

          <div className="mt-2 rounded-xl bg-brand-bg px-4 py-3 text-sm">
            <p className="font-bold text-brand-dark">
              {SERVICE_LABELS[bono.serviceType]}
            </p>
            <p className="mt-0.5 text-brand-muted">
              {bono.totalSessions} sessions · {formatEur(bono.price)}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/client/reservas"
              className="inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
            >
              Reservar una sessió
            </Link>
            <Link
              href="/client/bonos"
              className="inline-flex rounded-lg border border-brand-border px-4 py-2 text-sm font-bold text-brand-dark hover:border-brand-purple hover:text-brand-purple"
            >
              Veure els meus bons
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
