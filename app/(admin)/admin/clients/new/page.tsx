import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { ClientForm } from "@/components/forms/client-form";
import { listTrainers } from "@/lib/data/clients";
import { createClientAction } from "@/app/(admin)/admin/clients/actions";

export default async function NewClientPage() {
  const trainers = await listTrainers();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administración" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/clients"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Clientes
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nuevo cliente</h1>

        <ClientForm
          action={createClientAction}
          trainers={trainers}
          submitLabel="Crear cliente"
          cancelHref="/admin/clients"
        />
      </main>
    </div>
  );
}
