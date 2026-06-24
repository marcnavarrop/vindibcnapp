import Link from "next/link";
import { notFound } from "next/navigation";
import { MeasurementForm } from "@/components/forms/measurement-form";
import { getClient } from "@/lib/data/clients";
import { createMeasurementAction } from "@/app/(admin)/admin/clients/progres-actions";

export const dynamic = "force-dynamic";

export default async function NewMeasurementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const today = new Date().toISOString().slice(0, 10);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={`/admin/clients/${id}`}
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar a la fitxa
        </Link>
        <h1 className="mt-1 text-2xl text-brand-dark">Nova mesura</h1>
        <p className="mb-6 text-sm text-brand-muted">Per a {client.fullName}</p>

        <MeasurementForm
          action={createMeasurementAction.bind(null, id)}
          cancelHref={`/admin/clients/${id}`}
          today={today}
        />
      </main>
  );
}
