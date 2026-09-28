import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";
import { isBonoExpired } from "@/lib/data/bonos";
import type { BonoStatus, ServiceType } from "@/types/database";

/**
 * CREAR DES D'UN FORAT: A QUI I AMB QUIN BO.
 *
 * El professional crea reserves per als SEUS clients assignats: és el que
 * accepta `assertMayBookFor` en crear, i el que el selector ha d'oferir (ni un
 * de més, perquè fallaria en prémer Crear).
 *
 * El bo que es gasta no el tria qui reserva: és el MÉS ANTIC utilitzable del
 * servei (actiu o pendent de pagament, amb sessions i sense caducar), el mateix
 * criteri que fa servir el client quan reserva ell mateix. La pantalla l'ensenya
 * abans de crear; el servidor el torna a triar en crear (`pickUsableBono`), i
 * els dos surten d'aquí perquè no puguin dir coses diferents.
 */
export type BookableBono = {
  id: string;
  serviceType: ServiceType;
  remaining: number;
  total: number;
  expiresAt: string | null;
};
export type BookableClient = { id: string; name: string; bonos: BookableBono[] };

type BonoRow = {
  id: string;
  client_id: string;
  service_type: ServiceType;
  remaining_sessions: number;
  total_sessions: number;
  status: BonoStatus;
  expires_at: string | null;
  purchased_at: string;
};

/** Utilitzable i en ordre: el primer de cada servei és el que es gastaria. */
function usable(rows: BonoRow[]): BonoRow[] {
  return rows
    .filter(
      (b) =>
        (b.status === "active" || b.status === "pending_payment") &&
        b.remaining_sessions > 0 &&
        !isBonoExpired(b),
    )
    .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at));
}

const toBookable = (b: BonoRow): BookableBono => ({
  id: b.id,
  serviceType: b.service_type,
  remaining: b.remaining_sessions,
  total: b.total_sessions,
  expiresAt: b.expires_at,
});

/** Els clients assignats a aquest professional, amb els bons que poden gastar. */
export async function listBookableClients(trainerId: string): Promise<BookableClient[]> {
  if (USE_MOCK) {
    const s = getStore();
    return s.clients
      .filter((c) => c.assigned_trainer_id === trainerId)
      .map((c) => ({
        id: c.id,
        name: s.profiles.find((p) => p.id === c.profile_id)?.full_name ?? "—",
        bonos: usable(s.bonos.filter((b) => b.client_id === c.id) as BonoRow[]).map(toBookable),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id,
       profile:profiles!clients_profile_id_fkey(full_name),
       bonos(id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at)`,
    )
    .eq("assigned_trainer_id", trainerId);
  if (error) throw error;
  type Row = { id: string; profile: { full_name: string | null } | null; bonos: BonoRow[] };
  return (data as unknown as Row[])
    .map((c) => ({
      id: c.id,
      name: c.profile?.full_name ?? "—",
      bonos: usable(c.bonos).map(toBookable),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** El bo que es gastaria: el més antic utilitzable d'aquest servei, o cap. */
export async function pickUsableBono(
  clientId: string,
  serviceType: ServiceType,
): Promise<BookableBono | null> {
  let rows: BonoRow[];
  if (USE_MOCK) {
    rows = getStore().bonos.filter(
      (b) => b.client_id === clientId && b.service_type === serviceType,
    ) as BonoRow[];
  } else {
    const { data, error } = await createAdminClient()
      .from("bonos")
      .select("id, client_id, service_type, remaining_sessions, total_sessions, status, expires_at, purchased_at")
      .eq("client_id", clientId)
      .eq("service_type", serviceType)
      .in("status", ["active", "pending_payment"])
      .gt("remaining_sessions", 0)
      .or(`expires_at.is.null,expires_at.gte.${centerToday()}`);
    if (error) throw error;
    rows = (data ?? []) as BonoRow[];
  }
  const first = usable(rows)[0];
  return first ? toBookable(first) : null;
}
