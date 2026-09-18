import Link from "next/link";
import { notFound } from "next/navigation";
import { BonoForm } from "@/components/forms/bono-form";
import { getClient } from "@/lib/data/clients";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getLiveSubscription } from "@/lib/data/subscriptions";
import { centerToday } from "@/lib/center-time";
import {
  createBonoAction,
  createGroupSubscriptionAction,
} from "@/app/(admin)/admin/bonos/actions";
import { TAP } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewBonoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, services, settings] = await Promise.all([
    getClient(id),
    listActiveServices(),
    getCenterSettings(),
  ]);
  if (!client) notFound();

  // Amb clientId: l'admin dona d'alta un bo PER a aquest client, així que el
  // preu que ha de veure és el d'ell, segmentació inclosa.
  const effectivePricesMap = await getEffectivePrices(services, { clientId: id });
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  // Si ja en té una de viva no se'n pot obrir una segona: ho impedeix l'índex
  // únic de la 0072, i val més dir-ho abans que ensenyar un error després.
  // Només es pregunta si el centre les té obertes, com a /client/bonos.
  const liveSubscription = settings.subscriptionsEnabled
    ? await getLiveSubscription(client.id)
    : null;

  // El dia d'alta al centre és el que quedarà d'àncora. Es calcula al servidor
  // pel mateix motiu que a la pantalla del client: el navegador pot anar en una
  // altra zona horària i prometre un dia que després no es compliria.
  const renewalDay = Number(centerToday().slice(8, 10));

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={`/admin/clients/${id}`}
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Tornar a la fitxa
        </Link>
        <h1 className="mt-1 text-2xl text-brand-dark">Nou bo</h1>
        <p className="mb-6 text-sm text-brand-muted">Per a {client.fullName}</p>

        <BonoForm
          action={createBonoAction.bind(null, id)}
          subscribeAction={createGroupSubscriptionAction.bind(null, id)}
          cancelHref={`/admin/clients/${id}`}
          services={services}
          effectivePrices={effectivePrices}
          subscriptionsEnabled={settings.subscriptionsEnabled}
          hasLiveSubscription={liveSubscription !== null}
          renewalDay={renewalDay}
        />
      </main>
  );
}
