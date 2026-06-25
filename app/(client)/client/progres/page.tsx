import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listMeasurements } from "@/lib/data/measurements";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ClientProgresPage() {
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const measurements = client ? await listMeasurements(client.id) : [];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Progrés</h1>
      <p className="mb-6 text-sm text-brand-muted">
        El teu seguiment de mesures. Les registra el teu entrenador/a.
      </p>

      <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
        <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
          Mesures
        </h2>
        <div className="divide-y divide-brand-border">
          {measurements.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-brand-muted">
              Encara no hi ha mesures registrades.
            </p>
          ) : (
            measurements.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
              >
                <span className="font-bold text-brand-dark">
                  {formatDate(m.recordedAt)}
                </span>
                {m.weightKg != null && (
                  <span className="font-bold text-brand-purple">
                    {m.weightKg} kg
                  </span>
                )}
                {m.notes && (
                  <span className="text-brand-muted">{m.notes}</span>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
