"use server";

import { getViewer } from "@/lib/auth";
import { getProfileContact } from "@/lib/notifications";
import { resendInvite } from "@/lib/notifications/auth-emails";

export type ResendState = { ok?: boolean; error?: string };

/**
 * Reenvia la invitació (crear contrasenya) a un usuari ja creat: genera un
 * enllaç nou i li reenvia l'email de marca. Útil si no va arribar o va caducar.
 * Només admin.
 */
export async function resendInviteAction(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) return { error: "Falta l'usuari." };

  const contact = await getProfileContact(profileId);
  if (!contact?.email) return { error: "Aquest usuari no té correu." };

  const res = await resendInvite({
    profileId,
    email: contact.email,
    fullName: contact.name,
  });
  return res.ok
    ? { ok: true }
    : { error: res.error ?? "No s'ha pogut reenviar la invitació." };
}
