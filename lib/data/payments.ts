import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, type Store } from "@/lib/mock/store";
import type { PaymentMethod } from "@/types/database";

export type PaymentListItem = {
  id: string;
  clientName: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
};

function clientName(clientId: string, store: Store): string {
  const client = store.clients.find((c) => c.id === clientId);
  const profile = store.profiles.find((p) => p.id === client?.profile_id);
  return profile?.full_name ?? "—";
}

export async function listPayments(): Promise<PaymentListItem[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.payments
      .slice()
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
      .map((p) => ({
        id: p.id,
        clientName: clientName(p.client_id, store),
        amount: p.amount,
        method: p.method,
        paidAt: p.paid_at,
      }));
  }

  // ── Backend real (verificar al conectar Supabase). ──
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      `id, amount, method, paid_at,
       client:clients!payments_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`,
    )
    .order("paid_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    amount: number;
    method: PaymentMethod;
    paid_at: string;
    client: { profile: { full_name: string | null } | null } | null;
  };
  return (data as unknown as Row[]).map((p) => ({
    id: p.id,
    clientName: p.client?.profile?.full_name ?? "—",
    amount: p.amount,
    method: p.method,
    paidAt: p.paid_at,
  }));
}
