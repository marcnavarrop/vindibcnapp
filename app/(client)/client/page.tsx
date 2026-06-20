import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";

/**
 * Área del cliente. El middleware garantiza el rol 'client'.
 */
export default async function ClientHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Mi área" />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl text-brand-dark">Hola</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Sesión: {user?.email}
        </p>
        <div className="mt-6 rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Aquí verás tus bonos, reservas y pagos.
        </div>
      </main>
    </div>
  );
}
