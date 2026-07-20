import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { BonoForm } from "@/components/forms/bono-form";
import { getClient } from "@/lib/data/clients";
import { listActiveServices } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { createTrainerBonoAction } from "@/app/(trainer)/trainer/bonos/actions";

export const dynamic = "force-dynamic";

export default async function NewTrainerBonoPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  if (!clientId) redirect("/trainer/clients");

  const [viewer, client, services] = await Promise.all([
    getViewer(),
    getClient(clientId),
    listActiveServices(),
  ]);
  if (!client) notFound();

  // Solo se pueden crear bonos para clientes propios.
  if (!viewer || client.assignedTrainerId !== viewer.id) {
    redirect(`/trainer/clients/${clientId}`);
  }

  const effectivePricesMap = await getEffectivePrices(services);
  const effectivePrices = Object.fromEntries(effectivePricesMap);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={`/trainer/clients/${clientId}`}
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar a la fitxa
        </Link>
        <h1 className="mt-1 text-2xl text-brand-dark">Nou bo</h1>
        <p className="mb-6 text-sm text-brand-muted">Per a {client.fullName}</p>

        <BonoForm
          action={createTrainerBonoAction.bind(null, clientId)}
          cancelHref={`/trainer/clients/${clientId}`}
          services={services}
          effectivePrices={effectivePrices}
          showPayment={false}
        />
      </main>
  );
}
