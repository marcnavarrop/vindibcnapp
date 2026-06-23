import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { PaymentForm } from "@/components/forms/payment-form";
import { getPaymentFormData } from "@/lib/data/payments";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  const { clients } = await getPaymentFormData();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/pagos"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar a pagaments
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nou pagament</h1>

        <PaymentForm clients={clients} />
      </main>
    </div>
  );
}
