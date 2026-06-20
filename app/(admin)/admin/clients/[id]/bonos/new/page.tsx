import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { BonoForm } from "@/components/forms/bono-form";
import { getClient } from "@/lib/data/clients";
import { createBonoAction } from "@/app/(admin)/admin/bonos/actions";

export default async function NewBonoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administración" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={`/admin/clients/${id}`}
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Volver a la ficha
        </Link>
        <h1 className="mt-1 text-2xl text-brand-dark">Nuevo bono</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Para {client.fullName}
        </p>

        <BonoForm
          action={createBonoAction.bind(null, id)}
          cancelHref={`/admin/clients/${id}`}
        />
      </main>
    </div>
  );
}
