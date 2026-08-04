import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type CenterSettings = {
  minCancellationHours: number;
  trainersSeColleaguesReservations: boolean;
  referralProgramActive: boolean;
  referralRewardReferee: boolean;
  referralDiscountPercent: number;
  /** Horari del centre, en hores senceres (els calendaris són per hores). */
  openingHour: number;
  closingHour: number;
  /** Antelació mínima per reservar. 0 = sense restricció. */
  minBookingHours: number;
  /** Sessions restants per considerar un bo "a punt d'esgotar-se". */
  bonoLowThreshold: number;
  /** Hora local del centre a partir de la qual s'envien els recordatoris. */
  reminderHourLocal: number;
  /**
   * Mesos de validesa d'un bo des de la compra. Null = sense caducitat.
   * Canviar-lo NO afecta els bons ja comprats: cadascun porta la seva data.
   */
  bonoExpiryMonths: number | null;
  modules: {
    comunitat: boolean;
    sessionsProva: boolean;
    documents: boolean;
  };
};

const DEFAULT: CenterSettings = {
  minCancellationHours: 24,
  trainersSeColleaguesReservations: true,
  referralProgramActive: false,
  referralRewardReferee: true,
  referralDiscountPercent: 10,
  openingHour: 7,
  closingHour: 22,
  minBookingHours: 0,
  bonoLowThreshold: 1,
  reminderHourLocal: 20,
  bonoExpiryMonths: null,
  modules: { comunitat: true, sessionsProva: true, documents: true },
};

/**
 * "07:00:00" → 7. Els calendaris treballen amb hores senceres, així que del
 * `time` de la base de dades només se n'agafa l'hora.
 */
function hourOf(time: string | null | undefined, fallback: number): number {
  if (!time) return fallback;
  const h = parseInt(time.slice(0, 2), 10);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : fallback;
}

/** Hora sencera → "HH:00:00", per desar-la a la columna `time`. */
function timeOf(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00:00`;
}

export async function getCenterSettings(): Promise<CenterSettings> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const cs = getStore().centerSettings;
    return {
      minCancellationHours: cs?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
      trainersSeColleaguesReservations: cs?.trainers_see_colleagues_reservations ?? DEFAULT.trainersSeColleaguesReservations,
      referralProgramActive: cs?.referral_program_active ?? DEFAULT.referralProgramActive,
      referralRewardReferee: cs?.referral_reward_referee ?? DEFAULT.referralRewardReferee,
      referralDiscountPercent: cs?.referral_discount_percent ?? DEFAULT.referralDiscountPercent,
      openingHour: hourOf(cs?.opening_time, DEFAULT.openingHour),
      closingHour: hourOf(cs?.closing_time, DEFAULT.closingHour),
      minBookingHours: cs?.min_booking_hours ?? DEFAULT.minBookingHours,
      bonoLowThreshold: cs?.bono_low_threshold ?? DEFAULT.bonoLowThreshold,
      reminderHourLocal: cs?.reminder_hour_local ?? DEFAULT.reminderHourLocal,
      bonoExpiryMonths: cs?.bono_expiry_months ?? null,
      modules: {
        comunitat: cs?.module_comunitat_enabled ?? DEFAULT.modules.comunitat,
        sessionsProva: cs?.module_sessions_prova_enabled ?? DEFAULT.modules.sessionsProva,
        documents: cs?.module_documents_enabled ?? DEFAULT.modules.documents,
      },
    };
  }

  // Client de servei, no el de sessió: aquesta configuració la necessiten
  // pàgines PÚBLIQUES (la home, el login, /prova) on no hi ha ningú autenticat,
  // i la RLS de center_settings no deixa llegir res a un anònim. Amb el client
  // de sessió, `data` sortia null i tot queia als valors per defecte: un mòdul
  // desactivat es veia actiu per a qualsevol visitant, i el guard de la ruta
  // no arribava a saltar mai.
  //
  // No obre cap forat: aquí només es llegeix configuració del centre (horaris,
  // llindars, mòduls), i qui decideix què se'n publica és el servidor. Escriure
  // ja passava per aquest mateix client.
  const admin = createAdminClient();
  const { data } = await admin
    .from("center_settings")
    // Literal inline a propòsit: amb una constant, Supabase perd la inferència.
    .select(
      "min_cancellation_hours, trainers_see_colleagues_reservations, referral_program_active, referral_reward_referee, referral_discount_percent, opening_time, closing_time, min_booking_hours, bono_low_threshold, reminder_hour_local, bono_expiry_months, module_comunitat_enabled, module_sessions_prova_enabled, module_documents_enabled",
    )
    .single();

  return {
    minCancellationHours: data?.min_cancellation_hours ?? DEFAULT.minCancellationHours,
    trainersSeColleaguesReservations: data?.trainers_see_colleagues_reservations ?? DEFAULT.trainersSeColleaguesReservations,
    referralProgramActive: data?.referral_program_active ?? DEFAULT.referralProgramActive,
    referralRewardReferee: data?.referral_reward_referee ?? DEFAULT.referralRewardReferee,
    referralDiscountPercent: data?.referral_discount_percent ?? DEFAULT.referralDiscountPercent,
    openingHour: hourOf(data?.opening_time, DEFAULT.openingHour),
    closingHour: hourOf(data?.closing_time, DEFAULT.closingHour),
    minBookingHours: data?.min_booking_hours ?? DEFAULT.minBookingHours,
    bonoLowThreshold: data?.bono_low_threshold ?? DEFAULT.bonoLowThreshold,
    reminderHourLocal: data?.reminder_hour_local ?? DEFAULT.reminderHourLocal,
    bonoExpiryMonths: data?.bono_expiry_months ?? null,
    modules: {
      comunitat: data?.module_comunitat_enabled ?? DEFAULT.modules.comunitat,
      sessionsProva: data?.module_sessions_prova_enabled ?? DEFAULT.modules.sessionsProva,
      documents: data?.module_documents_enabled ?? DEFAULT.modules.documents,
    },
  };
}

export async function updateCenterSettings(
  input: Partial<CenterSettings>,
): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const now = new Date().toISOString();
    store.centerSettings ??= {
      id: true,
      min_cancellation_hours: DEFAULT.minCancellationHours,
      trainers_see_colleagues_reservations: DEFAULT.trainersSeColleaguesReservations,
      referral_program_active: DEFAULT.referralProgramActive,
      referral_reward_referee: DEFAULT.referralRewardReferee,
      referral_discount_percent: DEFAULT.referralDiscountPercent,
      opening_time: timeOf(DEFAULT.openingHour),
      closing_time: timeOf(DEFAULT.closingHour),
      min_booking_hours: DEFAULT.minBookingHours,
      bono_low_threshold: DEFAULT.bonoLowThreshold,
      reminder_hour_local: DEFAULT.reminderHourLocal,
      bono_expiry_months: DEFAULT.bonoExpiryMonths,
      module_comunitat_enabled: DEFAULT.modules.comunitat,
      module_sessions_prova_enabled: DEFAULT.modules.sessionsProva,
      module_documents_enabled: DEFAULT.modules.documents,
      created_at: now,
      updated_at: now,
    };
    const cs = store.centerSettings;
    if (input.minCancellationHours !== undefined) cs.min_cancellation_hours = input.minCancellationHours;
    if (input.trainersSeColleaguesReservations !== undefined) cs.trainers_see_colleagues_reservations = input.trainersSeColleaguesReservations;
    if (input.referralProgramActive !== undefined) cs.referral_program_active = input.referralProgramActive;
    if (input.referralRewardReferee !== undefined) cs.referral_reward_referee = input.referralRewardReferee;
    if (input.referralDiscountPercent !== undefined) cs.referral_discount_percent = input.referralDiscountPercent;
    if (input.openingHour !== undefined) cs.opening_time = timeOf(input.openingHour);
    if (input.closingHour !== undefined) cs.closing_time = timeOf(input.closingHour);
    if (input.minBookingHours !== undefined) cs.min_booking_hours = input.minBookingHours;
    if (input.bonoLowThreshold !== undefined) cs.bono_low_threshold = input.bonoLowThreshold;
    if (input.reminderHourLocal !== undefined) cs.reminder_hour_local = input.reminderHourLocal;
    if (input.bonoExpiryMonths !== undefined) cs.bono_expiry_months = input.bonoExpiryMonths;
    if (input.modules?.comunitat !== undefined) cs.module_comunitat_enabled = input.modules.comunitat;
    if (input.modules?.sessionsProva !== undefined) cs.module_sessions_prova_enabled = input.modules.sessionsProva;
    if (input.modules?.documents !== undefined) cs.module_documents_enabled = input.modules.documents;
    cs.updated_at = now;
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
    ...(input.openingHour !== undefined && { opening_time: timeOf(input.openingHour) }),
    ...(input.closingHour !== undefined && { closing_time: timeOf(input.closingHour) }),
    ...(input.minBookingHours !== undefined && { min_booking_hours: input.minBookingHours }),
    ...(input.bonoLowThreshold !== undefined && { bono_low_threshold: input.bonoLowThreshold }),
    ...(input.reminderHourLocal !== undefined && { reminder_hour_local: input.reminderHourLocal }),
    ...(input.bonoExpiryMonths !== undefined && { bono_expiry_months: input.bonoExpiryMonths }),
    ...(input.modules?.comunitat !== undefined && { module_comunitat_enabled: input.modules.comunitat }),
    ...(input.modules?.sessionsProva !== undefined && { module_sessions_prova_enabled: input.modules.sessionsProva }),
    ...(input.modules?.documents !== undefined && { module_documents_enabled: input.modules.documents }),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
