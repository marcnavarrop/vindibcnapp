import { EditExerciseScreen } from "@/components/exercises/edit-screen";

export const dynamic = "force-dynamic";

export default async function TrainerEditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditExerciseScreen base="/trainer/exercicis" id={id} />;
}
