import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listClientExercises } from "@/lib/data/client-exercises";
import { listExercises } from "@/lib/data/exercises";
import { listAllProgressForClient } from "@/lib/data/exercise-progress";
import { ClientExerciseLibrary } from "@/components/exercise-library";
import { AssignedExercises } from "@/components/client/assigned-exercises";
import { listExerciseCategories } from "@/lib/data/exercise-categories";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function ClientExercicisPage() {
  const t = await getTranslations("workouts");
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const [assigned, library, allProgress, categories] = await Promise.all([
    client ? listClientExercises(client.id) : Promise.resolve([]),
    listExercises(),
    client ? listAllProgressForClient(client.id) : Promise.resolve([]),
    listExerciseCategories(),
  ]);

  // Objecte pla i no `Map`: això travessa la frontera cap a un component de
  // client, i un Map no és serialitzable.
  const progressByAssignment = Object.fromEntries(
    assigned.map((a) => [
      a.id,
      allProgress.filter((p) => p.clientExerciseId === a.id),
    ]),
  );

  /*
   * Les dues seccions són peces de client i es tradueixen soles. La
   * biblioteca, a més, és la mateixa que fan servir l'admin i el professional,
   * en mode LECTURA: sense `basePath` ni `deleteAction` no surten l'editar,
   * l'esborrar ni l'enllaç a les categories. El client no en gestiona cap.
   */
  const assignedIds = new Set(assigned.map((a) => a.exerciseId));
  const rest = library.filter((e) => !assignedIds.has(e.id));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mb-6 text-sm text-brand-muted">{t("intro")}</p>

      {/* Els teus exercicis (destacats) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-purple uppercase">
          {t("yours")}
        </h2>
        <AssignedExercises
          assigned={assigned}
          progressByAssignment={progressByAssignment}
        />
      </section>

      {/* Biblioteca completa (lectura) */}
      <section>
        <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
          {t("library")}
        </h2>
        <ClientExerciseLibrary exercises={rest} categories={categories} />
      </section>
    </main>
  );
}
