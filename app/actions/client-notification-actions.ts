"use server";
import { getViewer } from "@/lib/auth";
import { getClient } from "@/lib/data/clients";
import { resendInvite } from "@/lib/notifications/auth-emails";
import { notify, getProfileContact } from "@/lib/notifications";
import { appLink } from "@/lib/notifications/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";
import { getStore } from "@/lib/mock/store";

export type NotificationActionResult = { ok: boolean; message: string };

export async function resendInviteAction(
  clientId: string,
): Promise<NotificationActionResult> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer")) {
    return { ok: false, message: "Sense permís." };
  }
  const client = await getClient(clientId);
  if (!client) return { ok: false, message: "Client no trobat." };
  if (!client.email) return { ok: false, message: "El client no té correu electrònic." };

  const res = await resendInvite({
    profileId: client.profileId,
    email: client.email,
    fullName: client.fullName,
  });
  return res.ok
    ? { ok: true, message: "Invitació reenviada correctament." }
    : { ok: false, message: res.error ?? "Error enviant la invitació." };
}

export async function notifyNewExercisesAction(
  clientId: string,
): Promise<NotificationActionResult> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer")) {
    return { ok: false, message: "Sense permís." };
  }
  const contact = await getProfileContact(await getProfileIdForClient(clientId));
  if (!contact) return { ok: false, message: "Client no trobat." };

  await notify(
    {
      type: "new_exercises_assigned",
      recipient: contact,
      data: { name: contact.name ?? "" },
    },
    { ignorePreferences: true },
  );
  return { ok: true, message: "Notificació d'exercicis enviada." };
}

export async function notifyNextSessionAction(
  clientId: string,
): Promise<NotificationActionResult> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer")) {
    return { ok: false, message: "Sense permís." };
  }

  const client = await getClient(clientId);
  if (!client) return { ok: false, message: "Client no trobat." };

  const now = new Date().toISOString();
  const next = client.reservations
    .filter((r) => r.status === "booked" && r.scheduledAt > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  if (!next) {
    return { ok: false, message: "No hi ha cap sessió propera programada." };
  }

  const contact = await getProfileContact(client.profileId);
  if (!contact) return { ok: false, message: "No s'ha pogut obtenir el contacte." };

  const when = new Date(next.scheduledAt).toLocaleString("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  await notify(
    {
      type: "session_reminder",
      recipient: contact,
      relatedId: next.id,
      data: {
        name: contact.name ?? "",
        when,
        service: next.serviceType,
        trainer: client.trainerName ?? "",
      },
    },
    { ignorePreferences: true },
  );
  return { ok: true, message: `Recordatori enviat per a la sessió del ${when}.` };
}

async function getProfileIdForClient(clientId: string): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const c = store.clients.find((x) => x.id === clientId);
    return c?.profile_id ?? clientId;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .single();
  return data?.profile_id ?? clientId;
}
