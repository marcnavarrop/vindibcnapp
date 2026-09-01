import { ExerciseCategoriesScreen } from "@/components/exercises/categories-screen";

export const dynamic = "force-dynamic";

export default async function AdminExerciseCategoriesPage() {
  return <ExerciseCategoriesScreen base="/admin/exercicis" />;
}
