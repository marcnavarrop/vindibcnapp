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
import { ExerciseForm } from "@/components/forms/exercise-form";
import { listExerciseCategories } from "@/lib/data/exercise-categories";
import { createExerciseAction } from "@/lib/actions/exercise-actions";

const BACK_LINK =
  "text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple";

/** Enllaç "← Biblioteca" de les pantalles de detall. */
function BackToLibrary({ base }: { base: string }) {
  return (
    <Link href={base} className={BACK_LINK}>
      ← Biblioteca
    </Link>
  );
}

/** Alta d'un exercici nou. */
export async function NewExerciseScreen({ base }: { base: string }) {
  const categories = await listExerciseCategories();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <BackToLibrary base={base} />
      <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nou exercici</h1>

      <ExerciseForm
        action={createExerciseAction.bind(null, base)}
        submitLabel="Crear exercici"
        cancelHref={base}
        categories={categories}
        basePath={base}
      />
    </main>
  );
}
