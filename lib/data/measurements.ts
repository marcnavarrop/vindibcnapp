import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";

export type Measurement = {
  id: string;
  recordedAt: string;
  weightKg: number | null;
  notes: string | null;
};

export type MeasurementInput = {
  clientId: string;
  recordedAt: string;
  weightKg: number | null;
  notes: string | null;
};

type Row = {
  id: string;
  recorded_at: string;
  weight_kg: number | null;
  notes: string | null;
};

const toMeasurement = (r: Row): Measurement => ({
  id: r.id,
  recordedAt: r.recorded_at,
  weightKg: r.weight_kg,
  notes: r.notes,
});

/** Mediciones de un cliente, de la más reciente a la más antigua. */
export async function listMeasurements(
  clientId: string,
): Promise<Measurement[]> {
  if (USE_MOCK) {
    return getStore()
      .measurements.filter((m) => m.client_id === clientId)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      .map(toMeasurement);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("measurements")
    .select("id, recorded_at, weight_kg, notes")
    .eq("client_id", clientId)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toMeasurement);
}

export async function createMeasurement(
  input: MeasurementInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.measurements.push({
      id: crypto.randomUUID(),
      client_id: input.clientId,
      recorded_at: input.recordedAt,
      weight_kg: input.weightKg,
      notes: input.notes,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("measurements").insert({
    client_id: input.clientId,
    recorded_at: input.recordedAt,
    weight_kg: input.weightKg,
    notes: input.notes,
  });
  if (error) throw error;
}

export async function deleteMeasurement(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.measurements = store.measurements.filter((m) => m.id !== id);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("measurements").delete().eq("id", id);
  if (error) throw error;
}
