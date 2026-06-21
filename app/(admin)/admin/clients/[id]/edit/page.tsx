import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ClientForm } from "@/components/forms/client-form";
import { getClient, listTrainers } from "@/lib/data/clients";
import { updateClientAction } from "@/app/(admin)/admin/clients/actions";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, trainers] = await Promise.all([
    getClient(id),
    listTrainers(),
  ]);
  if (!client) notFound();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={`/admin/clients/${id}`}
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar a la fitxa
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Editar client</h1>

        <ClientForm
          action={updateClientAction.bind(null, id)}
          trainers={trainers}
          submitLabel="Desar canvis"
          cancelHref={`/admin/clients/${id}`}
          defaults={{
            fullName: client.fullName,
            email: client.email,
            phone: client.phone ?? "",
            assignedTrainerId: client.assignedTrainerId ?? "",
            notes: client.notes ?? "",
          }}
        />
      </main>
    </div>
  );
}
