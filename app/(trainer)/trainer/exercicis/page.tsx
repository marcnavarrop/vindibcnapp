import { ExercisesLibraryScreen } from "@/components/exercises/library-screen";

export const dynamic = "force-dynamic";

export default async function TrainerExercicisPage() {
  return <ExercisesLibraryScreen base="/trainer/exercicis" />;
}
