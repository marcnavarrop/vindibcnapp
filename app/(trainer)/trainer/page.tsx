import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";

/**
 * Área del entrenador. El middleware garantiza el rol 'trainer'.
 */
export default async function TrainerHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Entrenador" />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl text-brand-dark">Panel del entrenador</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Sesión: {user?.email}
        </p>
        <div className="mt-6 rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Aquí verás tus clientes asignados y tus reservas.
        </div>
      </main>
    </div>
  );
}
