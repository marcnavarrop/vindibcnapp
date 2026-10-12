import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { BonoForm } from "@/components/forms/bono-form";
import { getClient } from "@/lib/data/clients";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getAnyLiveSubscription } from "@/lib/data/subscriptions";
import { centerToday } from "@/lib/center-time";
import {
  createTrainerBonoAction,
  createTrainerGroupSubscriptionAction,
} from "@/app/(trainer)/trainer/bonos/actions";
import { TAP } from "@/lib/utils";
import { demoCompatible } from "@/lib/demo-accounts";

export const dynamic = "force-dynamic";

export default async function NewTrainerBonoPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  if (!clientId) redirect("/trainer/clients");

  const [viewer, client, services, settings] = await Promise.all([
    getViewer(),
    getClient(clientId),
    listActiveServices(),
    getCenterSettings(),
  ]);
  if (!client) notFound();

  // Als seus clients, qualsevol bo. A la resta de clients reals, només un bo
  // de grup (0108): sense paquets d'altres serveis ni mensualitats (la
  // subscripció segueix essent només per als propis). Demo amb demo.
  if (!viewer || !demoCompatible(client.id, viewer.id)) {
    redirect(`/trainer/clients/${clientId}`);
  }
  const own = client.assignedTrainerId === viewer.id;
  const offered = own
    ? services
    : services.filter((s) => s.serviceType === "grupo_reducido" && !s.subscriptionOnly);

  // Amb clientId, igual que a l'àrea d'admin: el bo és per a aquest client.
  const effectivePricesMap = await getEffectivePrices(offered, { clientId });
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  // Mateixa pregunta que a l'àrea d'admin, i pel mateix motiu: l'índex únic de
  // la 0072 no deixa una segona subscripció viva del mateix servei.
  const liveSubscription = settings.subscriptionsEnabled && own
    ? await getAnyLiveSubscription(client.id)
    : null;

  const renewalDay = Number(centerToday().slice(8, 10));

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={`/trainer/clients/${clientId}`}
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Tornar a la fitxa
        </Link>
        <h1 className="mt-1 text-2xl text-brand-dark">Nou bo</h1>
        <p className={own ? "mb-6 text-sm text-brand-muted" : "text-sm text-brand-muted"}>
          Per a {client.fullName}
        </p>
        {!own && (
          <p className="mb-6 text-sm text-brand-muted" data-not-yours>
            No és client teu: només li pots crear un bo de grup. Les mensualitats
            i la resta de bons, el seu professional o l&apos;administració.
          </p>
        )}

        <BonoForm
          action={createTrainerBonoAction.bind(null, clientId)}
          subscribeAction={
            own ? createTrainerGroupSubscriptionAction.bind(null, clientId) : undefined
          }
          cancelHref={`/trainer/clients/${clientId}`}
          services={offered}
          effectivePrices={effectivePrices}
          showPayment={false}
          subscriptionsEnabled={settings.subscriptionsEnabled && own}
          hasLiveSubscription={liveSubscription !== null}
          renewalDay={renewalDay}
        />
      </main>
  );
}
