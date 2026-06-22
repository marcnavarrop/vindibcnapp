import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ServiceForm } from "@/components/forms/service-form";
import { getService } from "@/lib/data/services";
import { updateServiceAction } from "@/app/(admin)/admin/serveis/actions";

export const dynamic = "force-dynamic";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getService(id);
  if (!service) notFound();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/serveis"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Serveis
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Editar servei</h1>

        <ServiceForm
          action={updateServiceAction.bind(null, id)}
          submitLabel="Desar canvis"
          defaults={{
            serviceType: service.serviceType,
            name: service.name,
            price: service.price,
            defaultSessions: service.defaultSessions,
            active: service.active,
          }}
        />
      </main>
    </div>
  );
}
