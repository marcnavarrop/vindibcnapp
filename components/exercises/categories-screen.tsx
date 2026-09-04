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
import { ExerciseCategoriesManager } from "@/components/exercise-categories-manager";
import { listExerciseCategories } from "@/lib/data/exercise-categories";
import { TAP } from "@/lib/utils";

const BACK_LINK =
  "text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple";

/** Enllaç "← Biblioteca" de les pantalles de detall. */
function BackToLibrary({ base }: { base: string }) {
  return (
    <Link href={base} className={`${BACK_LINK} ${TAP}`}>
      ← Biblioteca
    </Link>
  );
}

/** Gestió de categories. Les fa servir tot el centre, no un rol concret. */
export async function ExerciseCategoriesScreen({ base }: { base: string }) {
  const categories = await listExerciseCategories();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <BackToLibrary base={base} />
      <h1 className="mt-1 mb-1 text-2xl text-brand-dark">
        Categories d&apos;exercicis
      </h1>
      <p className="mb-6 text-sm text-brand-muted">
        Les fa servir tot el centre. Una categoria amb exercicis no es pot
        esborrar: primer cal moure&apos;ls o esborrar-los.
      </p>

      <ExerciseCategoriesManager categories={categories} basePath={base} />
    </main>
  );
}
