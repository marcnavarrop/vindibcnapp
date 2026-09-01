import { NewExerciseScreen } from "@/components/exercises/new-screen";

export const dynamic = "force-dynamic";

export default async function AdminNewExercisePage() {
  return <NewExerciseScreen base="/admin/exercicis" />;
}
