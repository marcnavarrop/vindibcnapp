import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import {
  seedClients,
  seedProfiles,
  seedBonos,
} from "@/lib/mock/seed";

/** Cliente enriquecido para listados (nombre, entrenador, sesiones restantes). */
export type ClientListItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  trainerName: string | null;
  activeBonos: number;
  remainingSessions: number;
};

/**
 * Lista de clientes con datos agregados. Misma firma en simulación y en real,
 * para que la pantalla no cambie al conectar Supabase.
 */
export async function listClients(): Promise<ClientListItem[]> {
  if (USE_MOCK) {
    return seedClients.map((client) => {
      const profile = seedProfiles.find((p) => p.id === client.profile_id);
      const trainer = client.assigned_trainer_id
        ? seedProfiles.find((p) => p.id === client.assigned_trainer_id)
        : null;
      const bonos = seedBonos.filter(
        (b) => b.client_id === client.id && b.status === "active",
      );
      return {
        id: client.id,
        fullName: profile?.full_name ?? "—",
        email: profile?.email ?? "",
        phone: profile?.phone ?? null,
        trainerName: trainer?.full_name ?? null,
        activeBonos: bonos.length,
        remainingSessions: bonos.reduce(
          (sum, b) => sum + b.remaining_sessions,
          0,
        ),
      };
    });
  }

  // ── Backend real (Supabase). Se activará solo cuando USE_MOCK sea false. ──
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      `id, phone:profiles!clients_profile_id_fkey(phone),
       profile:profiles!clients_profile_id_fkey(full_name, email),
       trainer:profiles!clients_assigned_trainer_id_fkey(full_name),
       bonos(remaining_sessions, status)`,
    )
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = {
    id: string;
    profile: { full_name: string | null; email: string | null } | null;
    trainer: { full_name: string | null } | null;
    bonos: { remaining_sessions: number; status: string }[];
  };

  return (data as unknown as Row[]).map((row) => {
    const activeBonos = row.bonos.filter((b) => b.status === "active");
    return {
      id: row.id,
      fullName: row.profile?.full_name ?? "—",
      email: row.profile?.email ?? "",
      phone: null,
      trainerName: row.trainer?.full_name ?? null,
      activeBonos: activeBonos.length,
      remainingSessions: activeBonos.reduce(
        (sum, b) => sum + b.remaining_sessions,
        0,
      ),
    };
  });
}
