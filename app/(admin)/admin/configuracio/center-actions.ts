"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { updateCenterSettings } from "@/lib/data/center-settings";

export type CenterSettingsState = { error?: string; ok?: boolean };

/** Enter dins de rang, o `null` si el camp no és vàlid. */
function intInRange(fd: FormData, name: string, min: number, max: number): number | null {
  const n = parseInt(String(fd.get(name) ?? ""), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export async function updateCenterSettingsAction(
  _prev: CenterSettingsState,
  fd: FormData,
): Promise<CenterSettingsState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const raw = fd.get("minCancellationHours") as string;
  const hours = parseInt(raw, 10);
  if (isNaN(hours) || hours < 0)
    return { error: "El valor ha de ser un nombre enter positiu (o 0 per desactivar)." };
  if (hours > 168)
    return { error: "El límit màxim és 168 hores (7 dies)." };

  const trainersSeColleagues = fd.get("trainersSeColleaguesReservations") === "true";
  const referralProgramActive = fd.get("referralProgramActive") === "true";
  const referralRewardReferee = fd.get("referralRewardReferee") === "true";
  const rawPct = fd.get("referralDiscountPercent") as string | null;
  const referralDiscountPercent = rawPct ? parseFloat(rawPct) : 10;
  if (referralProgramActive && (isNaN(referralDiscountPercent) || referralDiscountPercent <= 0 || referralDiscountPercent > 100)) {
    return { error: "El percentatge de descompte ha de ser entre 1 i 100." };
  }

  const openingHour = intInRange(fd, "openingHour", 0, 22);
  const closingHour = intInRange(fd, "closingHour", 1, 23);
  if (openingHour === null || closingHour === null)
    return { error: "L'horari ha de ser en hores senceres del dia (0–23)." };
  if (closingHour <= openingHour)
    return { error: "L'hora de tancament ha de ser posterior a la d'obertura." };

  const minBookingHours = intInRange(fd, "minBookingHours", 0, 720);
  if (minBookingHours === null)
    return { error: "L'antelació mínima ha de ser entre 0 i 720 hores." };

  const bonoLowThreshold = intInRange(fd, "bonoLowThreshold", 0, 50);
  if (bonoLowThreshold === null)
    return { error: "El llindar de bo ha de ser entre 0 i 50 sessions." };

  // 0 (o buit) vol dir "sense caducitat": es desa com a null.
  const bonoExpiryMonthsRaw = intInRange(fd, "bonoExpiryMonths", 0, 120);
  if (bonoExpiryMonthsRaw === null)
    return { error: "La caducitat dels bons ha de ser entre 0 i 120 mesos." };
  const bonoExpiryMonths = bonoExpiryMonthsRaw === 0 ? null : bonoExpiryMonthsRaw;

  const pendingPaymentCancelEnabled =
    fd.get("pendingPaymentCancelEnabled") === "true";
  const pendingPaymentCancelHours = intInRange(fd, "pendingPaymentCancelHours", 1, 8760);
  // Només es valida si l'ajust està actiu: amb el toggle apagat, un valor
  // rar al camp no ha de bloquejar el desat de tota la resta.
  if (pendingPaymentCancelEnabled && pendingPaymentCancelHours === null)
    return { error: "El termini per cobrar ha de ser entre 1 i 8760 hores." };

  const giftVouchersEnabled = fd.get("giftVouchersEnabled") === "true";
  const giftVoucherExpiryMonths = intInRange(fd, "giftVoucherExpiryMonths", 1, 120);
  // Com el termini de cobrament: només es valida si l'ajust està actiu.
  if (giftVouchersEnabled && giftVoucherExpiryMonths === null)
    return { error: "La caducitat dels vals de regal ha de ser entre 1 i 120 mesos." };

  const waitlistEnabled = fd.get("waitlistEnabled") === "true";

  const reminderHourLocal = intInRange(fd, "reminderHourLocal", 0, 23);
  if (reminderHourLocal === null)
    return { error: "L'hora dels recordatoris ha de ser entre 0 i 23." };

  try {
    await updateCenterSettings({
      minCancellationHours: hours,
      trainersSeColleaguesReservations: trainersSeColleagues,
      referralProgramActive,
      referralRewardReferee,
      referralDiscountPercent: referralProgramActive ? referralDiscountPercent : undefined,
      openingHour,
      closingHour,
      minBookingHours,
      bonoLowThreshold,
      bonoExpiryMonths,
      pendingPaymentCancelEnabled,
      pendingPaymentCancelHours: pendingPaymentCancelHours ?? undefined,
      giftVouchersEnabled,
      giftVoucherExpiryMonths: giftVoucherExpiryMonths ?? undefined,
      waitlistEnabled,
      reminderHourLocal,
      modules: {
        comunitat: fd.get("moduleComunitat") === "true",
        sessionsProva: fd.get("moduleSessionsProva") === "true",
        documents: fd.get("moduleDocuments") === "true",
      },
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en desar la configuració.",
    };
  }

  // Els mòduls i l'horari afecten menús i calendaris de tota l'app, no només
  // aquesta pàgina: cal invalidar el layout arrel.
  revalidatePath("/", "layout");
  return { ok: true };
}
