import { ExerciseCategoriesScreen } from "@/components/exercises/categories-screen";

export const dynamic = "force-dynamic";

export default async function TrainerExerciseCategoriesPage() {
  return <ExerciseCategoriesScreen base="/trainer/exercicis" />;
}
