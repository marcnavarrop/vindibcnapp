import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type CenterSettings = {
  minCancellationHours: number;
  trainersSeColleaguesReservations: boolean;
};

const DEFAULT: CenterSettings = {
  minCancellationHours: 24,
  trainersSeColleaguesReservations: true,
};

export async function getCenterSettings(): Promise<CenterSettings> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    return {
      minCancellationHours: store.centerSettings?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
      trainersSeColleaguesReservations:
        store.centerSettings?.trainers_see_colleagues_reservations ?? DEFAULT.trainersSeColleaguesReservations,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_settings")
    .select("min_cancellation_hours, trainers_see_colleagues_reservations")
    .single();
  return {
    minCancellationHours: data?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
    trainersSeColleaguesReservations:
      data?.trainers_see_colleagues_reservations ?? DEFAULT.trainersSeColleaguesReservations,
  };
}

export async function updateCenterSettings(
  input: Partial<CenterSettings>,
): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    if (!store.centerSettings) {
      store.centerSettings = {
        id: true,
        min_cancellation_hours: DEFAULT.minCancellationHours,
        trainers_see_colleagues_reservations: DEFAULT.trainersSeColleaguesReservations,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    const cs = store.centerSettings;
    if (input.minCancellationHours !== undefined) {
      cs.min_cancellation_hours = input.minCancellationHours;
      cs.updated_at = new Date().toISOString();
    }
    if (input.trainersSeColleaguesReservations !== undefined) {
      cs.trainers_see_colleagues_reservations = input.trainersSeColleaguesReservations;
      cs.updated_at = new Date().toISOString();
    }
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("center_settings").upsert({
    id: true,
    ...(input.minCancellationHours !== undefined && {
      min_cancellation_hours: input.minCancellationHours,
    }),
    ...(input.trainersSeColleaguesReservations !== undefined && {
      trainers_see_colleagues_reservations: input.trainersSeColleaguesReservations,
    }),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
