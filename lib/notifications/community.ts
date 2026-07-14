import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore } from "@/lib/mock/store";
import { notify } from "@/lib/notifications";

/**
 * Notifica un anunci nou a qui tingui 'community_email' activat. Enviament en
 * batch seqüencial i best-effort: mai llança i mai bloqueja la publicació.
 *
 * ⚠️ Limitació: s'executa de forma síncrona dins de l'acció (no hi ha cua). Amb
 * el default (community_email = false per a tothom) la llista sol ser buida i
 * és inofensiu. Si el centre creix i molta gent l'activa, caldria moure-ho a
 * una cua/worker per no allargar la petició de l'admin.
 */
const MAX_BATCH = 500;

export async function notifyCommunity(input: {
  announcementId: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const recipients = await optedInRecipients();
    for (const r of recipients.slice(0, MAX_BATCH)) {
      await notify({
        type: "community",
        recipient: r,
        relatedId: input.announcementId,
        data: { name: r.name ?? "", title: input.title, body: input.body },
      });
    }
  } catch {
    // best-effort
  }
}

type Rec = { profileId: string; email: string | null; phone: string | null; name: string | null };

async function optedInRecipients(): Promise<Rec[]> {
  if (USE_MOCK) {
    const store = getStore();
    const ids = new Set(
      store.notification_preferences
        .filter((p) => p.community_email)
        .map((p) => p.profile_id),
    );
    return store.profiles
      .filter((p) => ids.has(p.id) && p.role !== "admin")
      .map((p) => ({ profileId: p.id, email: p.email, phone: p.phone, name: p.full_name }));
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_preferences")
    .select("profile_id, profile:profiles!notification_preferences_profile_id_fkey(email, phone, full_name, role)")
    .eq("community_email", true);
  type Row = {
    profile_id: string;
    profile: { email: string | null; phone: string | null; full_name: string | null; role: string } | null;
  };
  return ((data as unknown as Row[]) ?? [])
    .filter((r) => r.profile && r.profile.role !== "admin")
    .map((r) => ({
      profileId: r.profile_id,
      email: r.profile!.email,
      phone: r.profile!.phone,
      name: r.profile!.full_name,
    }));
}
