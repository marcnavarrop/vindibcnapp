"use server";

import { headers } from "next/headers";
import { createTrialBooking } from "@/lib/data/trial-bookings";

export type TrialFormState = { error?: string; ok?: boolean };

/** IP del sol·licitant a partir de les capçaleres del proxy (best-effort). */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/**
 * Sol·licitud pública de sessió de prova (sense login). Tota la validació
 * (finestra 24 h–30 dies, antiabús, disponibilitat, assignació d'entrenador)
 * viu a createTrialBooking. Aquí només es recullen i validen els camps.
 */
export async function requestTrialAction(
  _prev: TrialFormState,
  formData: FormData,
): Promise<TrialFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const consent = formData.get("consent") === "on";

  if (!fullName) return { error: "Indica el teu nom." };
  if (!/.+@.+\..+/.test(email)) return { error: "Indica un correu vàlid." };
  if (phone.length < 6) return { error: "Indica un telèfon vàlid." };
  if (!scheduledAt) return { error: "Tria una franja lliure." };
  if (!consent)
    return { error: "Cal acceptar la Política de Privacitat per continuar." };

  try {
    await createTrialBooking({
      fullName,
      email,
      phone,
      scheduledAt,
      ip: await clientIp(),
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut enviar la sol·licitud.",
    };
  }

  return { ok: true };
}
