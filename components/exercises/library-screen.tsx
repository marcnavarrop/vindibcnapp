import { TAP } from "@/lib/utils";
/**
 * Pantalles d'exercicis compartides per l'admin i el professional.
 *
 * Els exercicis són del CENTRE, no de qui els mira: les dues àrees ensenyaven
 * exactament la mateixa pantalla, i n'hi havia vuit fitxers (quatre per rol)
 * idèntics fins a l'última classe de Tailwind. L'únic que canviava era el
 * prefixe de les rutes, que ja vivia en una constant `BASE`; aquí puja a
 * paràmetre i prou.
 *
 * Una pantalla per fitxer i no totes juntes: cada pàgina només ha d'arrossegar
 * els components de client que fa servir. Amb les quatre en un sol mòdul, les
 * vuit pàgines passaven de 109 a 127 kB de JS inicial per carregar el formulari
 * i el gestor de categories que no pintaven.
 */
import Link from "next/link";
import { ExerciseLibrary } from "@/components/exercise-library";
import { listExercises } from "@/lib/data/exercises";
import { listExerciseCategories } from "@/lib/data/exercise-categories";
import { deleteExerciseAction } from "@/lib/actions/exercise-actions";

/** Llistat: la biblioteca sencera amb el botó de crear-ne un de nou. */
export async function ExercisesLibraryScreen({ base }: { base: string }) {
  const [exercises, categories] = await Promise.all([
    listExercises(),
    listExerciseCategories(),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Biblioteca d&apos;exercicis</h1>
        {/* `whitespace-nowrap` + `shrink-0`: a 375 px el text no hi cabia en
            una línia i es partia en dues, i com que l'alineació del text és a
            l'esquerra la línia curta ("+ NOU") deixava un buit a la dreta. El
            botó ha de mesurar el que mesura el seu text; qui s'ajusta és el
            títol del costat, que ja anava a dues línies. */}
        <Link
          href={`${base}/new`}
          className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
        >
          + Nou exercici
        </Link>
      </div>

      <ExerciseLibrary
        exercises={exercises}
        categories={categories}
        basePath={base}
        deleteAction={deleteExerciseAction.bind(null, base)}
      />
    </main>
  );
}
