"use server";

import { headers } from "next/headers";
import { createTrialBooking, TrialError } from "@/lib/data/trial-bookings";
import type { TrialErrorCode } from "@/lib/data/trial-bookings.constants";

export type { TrialErrorCode };

/**
 * El resultat porta un CODI, no una frase.
 *
 * Aquesta pantalla és pública i es veu en tres idiomes, i qui decideix el
 * motiu del rebuig és el servidor —que no sap ni ha de saber quina cookie
 * d'idioma porta el visitant—. La traducció la fa la pantalla, que sí que ho
 * sap. Mateix criteri que a les reserves.
 */
export type TrialFormState = { errorCode?: TrialErrorCode; ok?: boolean };

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

  if (!fullName) return { errorCode: "noName" };
  if (!/.+@.+\..+/.test(email)) return { errorCode: "badEmail" };
  if (phone.length < 6) return { errorCode: "badPhone" };
  if (!scheduledAt) return { errorCode: "noSlot" };
  if (!consent) return { errorCode: "noConsent" };

  try {
    await createTrialBooking({
      fullName,
      email,
      phone,
      scheduledAt,
      ip: await clientIp(),
    });
  } catch (e) {
    // Un TrialError ja diu per què; qualsevol altra cosa és un problema nostre
    // i el visitant no n'ha de llegir les interioritats.
    return { errorCode: e instanceof TrialError ? e.code : "failed" };
  }

  return { ok: true };
}
