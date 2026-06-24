import Link from "next/link";
import { ClientForm } from "@/components/forms/client-form";
import { listTrainers } from "@/lib/data/clients";
import { createClientAction } from "@/app/(admin)/admin/clients/actions";

export default async function NewClientPage() {
  const trainers = await listTrainers();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/clients"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Clients
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nou client</h1>

        <ClientForm
          action={createClientAction}
          trainers={trainers}
          submitLabel="Crear client"
          cancelHref="/admin/clients"
        />
      </main>
  );
}
