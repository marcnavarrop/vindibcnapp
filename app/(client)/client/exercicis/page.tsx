import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listExercises } from "@/lib/data/exercises";
import { Badge } from "@/components/ui/badge";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ClientExercicisPage() {
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const [assigned, library] = await Promise.all([
    client ? listClientExercises(client.id) : Promise.resolve([]),
    listExercises(),
  ]);

  const assignedIds = new Set(assigned.map((a) => a.exerciseId));
  const rest = library.filter((e) => !assignedIds.has(e.id));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Exercicis</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Els exercicis que t&apos;ha assignat el teu entrenador/a i la biblioteca
        del centre.
      </p>

      {/* Els teus exercicis (destacats) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-purple uppercase">
          Els teus exercicis
        </h2>
        {assigned.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
            Encara no tens cap exercici assignat.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {assigned.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-2xl border-2 border-brand-purple/30 bg-brand-purple/5 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg text-brand-dark">{a.name}</h3>
                  <Badge tone="info">
                    {EXERCISE_CATEGORY_LABELS[a.category]}
                  </Badge>
                </div>
                {a.notes && (
                  <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand-charcoal">
                    {a.notes}
                  </p>
                )}
                {a.description && (
                  <p className="text-sm text-brand-muted">{a.description}</p>
                )}
                {a.videoUrl && (
                  <a
                    href={a.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-brand-purple hover:text-brand-orange"
                  >
                    ▶ Veure vídeo
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Biblioteca completa (lectura) */}
      <section>
        <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
          Biblioteca completa
        </h2>
        {rest.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
            No hi ha més exercicis a la biblioteca.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rest.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg text-brand-dark">{e.name}</h3>
                  <Badge tone="info">
                    {EXERCISE_CATEGORY_LABELS[e.category]}
                  </Badge>
                </div>
                {e.description && (
                  <p className="text-sm text-brand-muted">{e.description}</p>
                )}
                {e.videoUrl && (
                  <a
                    href={e.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-brand-purple hover:text-brand-orange"
                  >
                    ▶ Veure vídeo
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
