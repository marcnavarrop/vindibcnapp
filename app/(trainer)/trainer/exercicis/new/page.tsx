import { NewExerciseScreen } from "@/components/exercises/new-screen";

export const dynamic = "force-dynamic";

export default async function TrainerNewExercisePage() {
  return <NewExerciseScreen base="/trainer/exercicis" />;
}
