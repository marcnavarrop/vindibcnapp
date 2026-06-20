import { getViewer } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";

/**
 * Área del entrenador. El middleware garantiza el rol 'trainer'.
 */
export default async function TrainerHome() {
  const viewer = await getViewer();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Entrenador" home="/trainer" />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl text-brand-dark">
          Hola, {viewer?.fullName?.split(" ")[0] ?? "entrenador"}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">{viewer?.email}</p>
        <div className="mt-6 rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Aquí verás tus clientes asignados y tus reservas.
        </div>
      </main>
    </div>
  );
}
