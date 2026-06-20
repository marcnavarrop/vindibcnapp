import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Área del entrenador. El middleware garantiza el rol 'trainer'.
 */
export default async function TrainerHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel del entrenador</h1>
        <SignOutButton />
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Sesión: {user?.email}. Aquí verás tus clientes asignados y tus reservas.
      </p>
    </main>
  );
}
