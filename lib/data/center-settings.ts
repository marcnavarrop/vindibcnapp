import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type CenterSettings = {
  minCancellationHours: number;
  trainersSeColleaguesReservations: boolean;
  referralProgramActive: boolean;
  referralRewardReferee: boolean;
  referralDiscountPercent: number;
};

const DEFAULT: CenterSettings = {
  minCancellationHours: 24,
  trainersSeColleaguesReservations: true,
  referralProgramActive: false,
  referralRewardReferee: true,
  referralDiscountPercent: 10,
};

export async function getCenterSettings(): Promise<CenterSettings> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    const cs = store.centerSettings;
    return {
      minCancellationHours: cs?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
      trainersSeColleaguesReservations: cs?.trainers_see_colleagues_reservations ?? DEFAULT.trainersSeColleaguesReservations,
      referralProgramActive: cs?.referral_program_active ?? DEFAULT.referralProgramActive,
      referralRewardReferee: cs?.referral_reward_referee ?? DEFAULT.referralRewardReferee,
      referralDiscountPercent: cs?.referral_discount_percent ?? DEFAULT.referralDiscountPercent,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("center_settings")
    .select("min_cancellation_hours, trainers_see_colleagues_reservations, referral_program_active, referral_reward_referee, referral_discount_percent")
    .single();
  return {
    minCancellationHours: data?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
    trainersSeColleaguesReservations: data?.trainers_see_colleagues_reservations ?? DEFAULT.trainersSeColleaguesReservations,
    referralProgramActive: data?.referral_program_active ?? DEFAULT.referralProgramActive,
    referralRewardReferee: data?.referral_reward_referee ?? DEFAULT.referralRewardReferee,
    referralDiscountPercent: data?.referral_discount_percent ?? DEFAULT.referralDiscountPercent,
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
        referral_program_active: DEFAULT.referralProgramActive,
        referral_reward_referee: DEFAULT.referralRewardReferee,
        referral_discount_percent: DEFAULT.referralDiscountPercent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    const cs = store.centerSettings;
    if (input.minCancellationHours !== undefined) cs.min_cancellation_hours = input.minCancellationHours;
    if (input.trainersSeColleaguesReservations !== undefined) cs.trainers_see_colleagues_reservations = input.trainersSeColleaguesReservations;
    if (input.referralProgramActive !== undefined) cs.referral_program_active = input.referralProgramActive;
    if (input.referralRewardReferee !== undefined) cs.referral_reward_referee = input.referralRewardReferee;
    if (input.referralDiscountPercent !== undefined) cs.referral_discount_percent = input.referralDiscountPercent;
    cs.updated_at = new Date().toISOString();
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("center_settings").upsert({
    id: true,
    ...(input.minCancellationHours !== undefined && { min_cancellation_hours: input.minCancellationHours }),
    ...(input.trainersSeColleaguesReservations !== undefined && { trainers_see_colleagues_reservations: input.trainersSeColleaguesReservations }),
    ...(input.referralProgramActive !== undefined && { referral_program_active: input.referralProgramActive }),
    ...(input.referralRewardReferee !== undefined && { referral_reward_referee: input.referralRewardReferee }),
    ...(input.referralDiscountPercent !== undefined && { referral_discount_percent: input.referralDiscountPercent }),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
