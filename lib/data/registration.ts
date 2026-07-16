import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { sendEmail, CENTER_EMAIL } from "@/lib/email";
import { renderWelcomeEmail } from "@/lib/notifications/templates";
import { appLink } from "@/lib/notifications/brand";
import { writeLog } from "@/lib/notifications/log";
import { notify } from "@/lib/notifications";

/**
 * Post-registre d'un client que s'ha donat d'alta pel seu compte (/register):
 *  1. Crea la fila `clients` si no existeix (el trigger només crea el perfil).
 *  2. Email de benvinguda al client (best-effort).
 *  3. Avís de "nou client" als admins (segons preferència) + CENTER_EMAIL.
 *
 * IDEMPOTENT i SENSE solapament amb l'alta per admin: si la fila `clients` ja
 * existeix (perquè ja s'ha processat o perquè l'ha creat un admin), no fa res.
 * Best-effort absolut: mai llança.
 */
export async function onNewClientRegistered(profileId: string): Promise<void> {
  try {
    if (USE_MOCK) {
      await mockFlow(profileId);
      return;
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name, role")
      .eq("id", profileId)
      .maybeSingle();
    if (!profile || profile.role !== "client") return;

    // Ja processat o alta feta per admin → no dupliquem.
    const { data: existing } = await admin
      .from("clients")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (existing) return;

    const { data: created } = await admin
      .from("clients")
      .insert({ profile_id: profileId })
      .select("id")
      .single();
    const clientId = created?.id ?? null;

    await sendWelcome(profileId, profile.email, profile.full_name);
    await notifyAdmins(profile.full_name, profile.email, clientId);
  } catch {
    // best-effort: el registre no s'ha de trencar mai per aquests avisos.
  }
}

async function sendWelcome(
  profileId: string,
  email: string | null,
  name: string | null,
): Promise<void> {
  if (!email) return;
  const { subject, html, text } = renderWelcomeEmail({
    name,
    url: appLink("/client"),
  });
  const res = await sendEmail({ to: email, subject, html, text });
  await writeLog({
    profileId,
    recipient: email,
    eventType: "auth_welcome",
    channel: "email",
    status: res.ok ? "sent" : "failed",
    error: res.error ?? null,
  });
}

async function notifyAdmins(
  clientName: string | null,
  clientEmail: string | null,
  clientId: string | null,
): Promise<void> {
  const url = clientId
    ? appLink(`/admin/clients/${clientId}`)
    : appLink("/admin/clients");
  const data = {
    client: clientName ?? "Client nou",
    clientEmail: clientEmail ?? "",
    url,
  };

  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("id, email, phone, full_name")
    .eq("role", "admin");
  for (const a of admins ?? []) {
    await notify({
      type: "new_client_registered",
      recipient: { profileId: a.id, email: a.email, phone: a.phone, name: a.full_name },
      data: { ...data, name: a.full_name ?? "" },
    });
  }
  // Correu general del centre (operatiu: ignora preferències d'usuari).
  if (CENTER_EMAIL)
    await notify(
      {
        type: "new_client_registered",
        recipient: { profileId: null, email: CENTER_EMAIL, phone: null, name: "Centre" },
        data: { ...data, name: "" },
      },
      { ignorePreferences: true },
    );
}

/** Versió mock (per completesa; el registre real no s'executa en mode demo). */
async function mockFlow(profileId: string): Promise<void> {
  const store = getStore();
  const profile = store.profiles.find((p) => p.id === profileId);
  if (!profile || profile.role !== "client") return;
  if (store.clients.some((c) => c.profile_id === profileId)) return;
  const clientId = crypto.randomUUID();
  store.clients.push({
    id: clientId,
    profile_id: profileId,
    assigned_trainer_id: null,
    notes: null,
    created_at: new Date().toISOString(),
  });
  saveStore(store);
  await sendWelcome(profileId, profile.email, profile.full_name);
  await notifyAdmins(profile.full_name, profile.email, clientId);
}
