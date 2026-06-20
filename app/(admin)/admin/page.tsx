import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Área de administración. El acceso ya está garantizado por el middleware
 * (solo entra aquí un usuario con rol 'admin').
 */
export default async function AdminHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <SignOutButton />
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Sesión: {user?.email}. Aquí irán clientes, bonos, reservas y pagos.
      </p>
    </main>
  );
}
