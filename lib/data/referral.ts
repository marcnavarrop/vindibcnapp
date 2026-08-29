import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReferralRewardStatus } from "@/types/database";

export type PendingReward = {
  id: string;
  discountPercent: number;
};

export type ReferralRewardAdminRow = {
  id: string;
  referrerName: string;
  refereeName: string;
  beneficiaryName: string;
  discountPercent: number;
  status: ReferralRewardStatus;
  createdAt: string;
};

const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateMockReferralCode(fullName: string): string {
  let prefix = fullName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/[ILO]/g, "")
    .slice(0, 3);
  while (prefix.length < 3) {
    prefix += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return `${prefix}-${suffix}`;
}

/** Validates a referral code. Returns the client_id of the owner, or null. */
export async function validateReferralCode(
  code: string,
  excludeClientId?: string,
): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    const client = store.clients.find(
      (c) => c.referral_code === normalized && c.id !== excludeClientId,
    );
    return client?.id ?? null;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select("id")
    .eq("referral_code", normalized)
    .maybeSingle();
  if (!data || data.id === excludeClientId) return null;
  return data.id;
}

/** Returns the first pending reward for a client (beneficiary), if any. */
export async function getPendingReferralReward(
  profileId: string,
): Promise<PendingReward | null> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === profileId);
    if (!client) return null;
    const reward = store.referral_rewards.find(
      (r) => r.beneficiary_client_id === client.id && r.status === "pending",
    );
    if (!reward) return null;
    return { id: reward.id, discountPercent: reward.discount_percent };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!client) return null;

  const { data } = await admin
    .from("referral_rewards")
    .select("id, discount_percent")
    .eq("beneficiary_client_id", client.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, discountPercent: data.discount_percent };
}

/**
 * Generates referral rewards when the FIRST bono of a referred client is paid.
 * Creates one reward for the referrer (always) and one for the referee (if
 * referral_reward_referee is active). Idempotent: skips if rewards already exist.
 */
export async function maybeGenerateReferralRewards(
  clientId: string,
): Promise<void> {
  const { getCenterSettings } = await import("@/lib/data/center-settings");
  const settings = await getCenterSettings();
  if (!settings.referralProgramActive) return;

  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const client = store.clients.find((c) => c.id === clientId);
    if (!client?.referred_by_client_id) return;
    const alreadyExists = store.referral_rewards.some(
      (r) => r.referee_client_id === clientId,
    );
    if (alreadyExists) return;

    const now = new Date().toISOString();
    const dp = settings.referralDiscountPercent;
    store.referral_rewards.push({
      id: crypto.randomUUID(),
      referrer_client_id: client.referred_by_client_id,
      referee_client_id: clientId,
      beneficiary_client_id: client.referred_by_client_id,
      discount_percent: dp,
      status: "pending",
      used_in_bono_id: null,
      created_at: now,
    });
    if (settings.referralRewardReferee) {
      store.referral_rewards.push({
        id: crypto.randomUUID(),
        referrer_client_id: client.referred_by_client_id,
        referee_client_id: clientId,
        beneficiary_client_id: clientId,
        discount_percent: dp,
        status: "pending",
        used_in_bono_id: null,
        created_at: now,
      });
    }
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, referred_by_client_id")
    .eq("id", clientId)
    .single();
  if (!client?.referred_by_client_id) return;

  const { data: existing } = await admin
    .from("referral_rewards")
    .select("id")
    .eq("referee_client_id", clientId)
    .maybeSingle();
  if (existing) return;

  const dp = settings.referralDiscountPercent;
  const rows = [
    {
      referrer_client_id: client.referred_by_client_id,
      referee_client_id: clientId,
      beneficiary_client_id: client.referred_by_client_id,
      discount_percent: dp,
    },
    ...(settings.referralRewardReferee
      ? [
          {
            referrer_client_id: client.referred_by_client_id,
            referee_client_id: clientId,
            beneficiary_client_id: clientId,
            discount_percent: dp,
          },
        ]
      : []),
  ];
  await admin.from("referral_rewards").insert(rows);
}

/** Marks a reward as used and links it to the bono. */
export async function applyReferralReward(
  rewardId: string,
  bonoId: string,
): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const reward = store.referral_rewards.find((r) => r.id === rewardId);
    if (reward) {
      reward.status = "used";
      reward.used_in_bono_id = bonoId;
      saveStore(store);
    }
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("referral_rewards")
    .update({ status: "used", used_in_bono_id: bonoId })
    .eq("id", rewardId);
}

/** Returns referral code and count of clients this client has referred. */
/**
 * Consumeix la recompensa NOMÉS si encara està pendent. Torna si l'ha aplicada.
 *
 * Cal per al pagament amb targeta: el descompte es calcula en obrir la sessió
 * de Stripe i no es gasta fins que el cobrament es confirma, que poden ser
 * minuts després. Entremig el client podria haver comprat un altre bo pagant al
 * centre i haver-la gastat allà. Sense el `eq('status','pending')`, el webhook
 * la tornaria a marcar com a usada i li canviaria el bo de destí: la mateixa
 * recompensa constaria gastada dues vegades i cap dels dos registres diria la
 * veritat.
 *
 * Si torna false, el client ja ha pagat el preu amb descompte a Stripe i no
 * s'hi pot fer res: mana el rebut. Es deixa passar a posta.
 */
export async function applyReferralRewardIfPending(
  rewardId: string,
  bonoId: string,
): Promise<boolean> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const reward = store.referral_rewards.find(
      (r) => r.id === rewardId && r.status === "pending",
    );
    if (!reward) return false;
    reward.status = "used";
    reward.used_in_bono_id = bonoId;
    saveStore(store);
    return true;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("referral_rewards")
    .update({ status: "used", used_in_bono_id: bonoId })
    .eq("id", rewardId)
    .eq("status", "pending")
    .select("id");
  return (data?.length ?? 0) > 0;
}

export async function getReferralStats(profileId: string): Promise<{
  code: string | null;
  referredCount: number;
}> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    const client = store.clients.find((c) => c.profile_id === profileId);
    if (!client) return { code: null, referredCount: 0 };
    const referredCount = store.clients.filter(
      (c) => c.referred_by_client_id === client.id,
    ).length;
    return { code: client.referral_code ?? null, referredCount };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, referral_code")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!client) return { code: null, referredCount: 0 };

  const { count } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_client_id", client.id);

  return { code: client.referral_code ?? null, referredCount: count ?? 0 };
}

/** Admin: list all referral rewards with names. */
export async function listReferralRewardsAdmin(): Promise<ReferralRewardAdminRow[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    return store.referral_rewards
      .map((r) => {
        const getName = (clientId: string) => {
          const c = store.clients.find((x) => x.id === clientId);
          return store.profiles.find((p) => p.id === c?.profile_id)?.full_name ?? "—";
        };
        return {
          id: r.id,
          referrerName: getName(r.referrer_client_id),
          refereeName: getName(r.referee_client_id),
          beneficiaryName: getName(r.beneficiary_client_id),
          discountPercent: r.discount_percent,
          status: r.status,
          createdAt: r.created_at,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("referral_rewards")
    .select(
      `id, discount_percent, status, created_at,
       referrer:clients!referral_rewards_referrer_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name)),
       referee:clients!referral_rewards_referee_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name)),
       beneficiary:clients!referral_rewards_beneficiary_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))`,
    )
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    id: string;
    discount_percent: number;
    status: string;
    created_at: string;
    referrer: { profile: { full_name: string | null } | null } | null;
    referee: { profile: { full_name: string | null } | null } | null;
    beneficiary: { profile: { full_name: string | null } | null } | null;
  }>).map((r) => ({
    id: r.id,
    referrerName: r.referrer?.profile?.full_name ?? "—",
    refereeName: r.referee?.profile?.full_name ?? "—",
    beneficiaryName: r.beneficiary?.profile?.full_name ?? "—",
    discountPercent: r.discount_percent,
    status: r.status as ReferralRewardStatus,
    createdAt: r.created_at,
  }));
}
