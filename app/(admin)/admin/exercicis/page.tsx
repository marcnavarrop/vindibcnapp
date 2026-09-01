import { ExercisesLibraryScreen } from "@/components/exercises/library-screen";

export const dynamic = "force-dynamic";

export default async function AdminExercicisPage() {
  return <ExercisesLibraryScreen base="/admin/exercicis" />;
}
