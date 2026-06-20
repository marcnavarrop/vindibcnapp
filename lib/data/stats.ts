import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/mock/store";

export type AdminStats = {
  clients: number;
  activeBonos: number;
  remainingSessions: number;
  revenue: number;
  upcomingReservations: number;
};

/** KPIs para el panel de administración. */
export async function getAdminStats(): Promise<AdminStats> {
  if (USE_MOCK) {
    const store = getStore();
    const active = store.bonos.filter((b) => b.status === "active");
    return {
      clients: store.clients.length,
      activeBonos: active.length,
      remainingSessions: active.reduce((s, b) => s + b.remaining_sessions, 0),
      revenue: store.payments.reduce((s, p) => s + p.amount, 0),
      upcomingReservations: store.reservations.filter(
        (r) => r.status === "booked",
      ).length,
    };
  }

  // ── Backend real (verificar al conectar Supabase). ──
  const supabase = await createClient();
  const [clientsRes, bonosRes, paymentsRes, reservationsRes] =
    await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("bonos").select("remaining_sessions").eq("status", "active"),
      supabase.from("payments").select("amount"),
      supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "booked"),
    ]);

  const bonos = (bonosRes.data ?? []) as { remaining_sessions: number }[];
  const payments = (paymentsRes.data ?? []) as { amount: number }[];

  return {
    clients: clientsRes.count ?? 0,
    activeBonos: bonos.length,
    remainingSessions: bonos.reduce((s, b) => s + b.remaining_sessions, 0),
    revenue: payments.reduce((s, p) => s + p.amount, 0),
    upcomingReservations: reservationsRes.count ?? 0,
  };
}
