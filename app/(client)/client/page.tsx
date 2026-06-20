import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Área del cliente. El middleware garantiza el rol 'client'.
 */
export default async function ClientHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi área</h1>
        <SignOutButton />
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Sesión: {user?.email}. Aquí verás tus bonos, reservas y pagos.
      </p>
    </main>
  );
}
