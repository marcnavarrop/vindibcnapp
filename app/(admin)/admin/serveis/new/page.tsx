import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { ServiceForm } from "@/components/forms/service-form";
import { createServiceAction } from "@/app/(admin)/admin/serveis/actions";

export default function NewServicePage() {
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
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nou servei</h1>

        <ServiceForm action={createServiceAction} submitLabel="Crear servei" />
      </main>
    </div>
  );
}
