import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type CenterSettings = {
  minCancellationHours: number;
};

const DEFAULT: CenterSettings = { minCancellationHours: 24 };

export async function getCenterSettings(): Promise<CenterSettings> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    return {
      minCancellationHours: store.centerSettings?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_settings")
    .select("min_cancellation_hours")
    .single();
  return {
    minCancellationHours: data?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    if (input.minCancellationHours !== undefined) {
      store.centerSettings.min_cancellation_hours = input.minCancellationHours;
      store.centerSettings.updated_at = new Date().toISOString();
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
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
