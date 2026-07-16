import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { createUserWithInvite } from "@/lib/notifications/auth-emails";
import type { Specialty } from "@/types/database";

export type TrainerListItem = {
  id: string;
  fullName: string;
  email: string;
  specialty: Specialty | null;
  clientCount: number;
};

export type TrainerDetail = {
  id: string;
  fullName: string;
  email: string;
  specialty: Specialty | null;
};

export type TrainerInput = {
  fullName: string;
  email: string;
  specialty: Specialty | null;
};

/** Listado de entrenadores con su especialidad y nº de clientes asignados. */
export async function listTrainersDetailed(): Promise<TrainerListItem[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.profiles
      .filter((p) => p.role === "trainer")
      .map((p) => ({
        id: p.id,
        fullName: p.full_name ?? "—",
        email: p.email ?? "",
        specialty: p.specialty,
        clientCount: store.clients.filter(
          (c) => c.assigned_trainer_id === p.id,
        ).length,
      }));
  }

  const supabase = await createClient();
  const [{ data: trainers, error: tErr }, { data: clients, error: cErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, specialty")
        .eq("role", "trainer")
        .order("full_name"),
      supabase.from("clients").select("assigned_trainer_id"),
    ]);
  if (tErr) throw tErr;
  if (cErr) throw cErr;

  const counts = new Map<string, number>();
  for (const c of clients ?? []) {
    if (c.assigned_trainer_id)
      counts.set(
        c.assigned_trainer_id,
        (counts.get(c.assigned_trainer_id) ?? 0) + 1,
      );
  }

  return (trainers ?? []).map((t) => ({
    id: t.id,
    fullName: t.full_name ?? "—",
    email: t.email ?? "",
    specialty: t.specialty,
    clientCount: counts.get(t.id) ?? 0,
  }));
}

/** Ficha de un entrenador por su id de perfil. */
export async function getTrainer(id: string): Promise<TrainerDetail | null> {
  if (USE_MOCK) {
    const p = getStore().profiles.find(
      (x) => x.id === id && x.role === "trainer",
    );
    return p
      ? {
          id: p.id,
          fullName: p.full_name ?? "—",
          email: p.email ?? "",
          specialty: p.specialty,
        }
      : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, specialty, role")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role !== "trainer") return null;
  return {
    id: data.id,
    fullName: data.full_name ?? "—",
    email: data.email ?? "",
    specialty: data.specialty,
  };
}

/**
 * Crea un entrenador: usuario en Supabase Auth (Admin API) con rol 'trainer'
 * en los metadatos —el trigger crea su perfil— y luego fija la especialidad.
 * Devuelve el id del nuevo perfil.
 */
export async function createTrainer(input: TrainerInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.profiles.push({
      id,
      full_name: input.fullName,
      email: input.email,
      phone: null,
      role: "trainer",
      specialty: input.specialty,
      preferred_language: "ca",
      birth_date: null,
      height_cm: null,
      weight_kg: null,
      gender: null,
      emergency_contact: null,
      objective: null,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return id;
  }

  // Crea l'usuari (rol als metadates; el trigger crea el perfil) i li envia la
  // invitació de marca via Resend. Email best-effort; l'alta no es trenca si
  // falla (l'admin pot reenviar-la).
  const id = await createUserWithInvite({
    email: input.email,
    fullName: input.fullName,
    role: "trainer",
  });
  const admin = createAdminClient();
  // El trigger ya creó el perfil con rol 'trainer'; fijamos la especialidad.
  const { error: updErr } = await admin
    .from("profiles")
    .update({ specialty: input.specialty })
    .eq("id", id);
  if (updErr) throw updErr;
  return id;
}

/** Actualiza la especialidad de un entrenador existente. */
export async function updateTrainerSpecialty(
  id: string,
  specialty: Specialty | null,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const p = store.profiles.find((x) => x.id === id && x.role === "trainer");
    if (!p) throw new Error("Entrenador/a no trobat/da.");
    p.specialty = specialty;
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ specialty })
    .eq("id", id);
  if (error) throw error;
}
