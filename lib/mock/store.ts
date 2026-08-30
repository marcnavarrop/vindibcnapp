import "server-only";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  seedProfiles,
  seedClients,
  seedBonos,
  seedReservations,
  seedPayments,
  seedServices,
  seedExerciseCategories,
  seedExercises,
  seedExerciseProgress,
  seedAnnouncements,
  seedPolls,
  seedPollOptions,
  seedPollResponses,
  seedClientExercises,
  seedAvailabilityRules,
  seedConsents,
  seedDataAccessLog,
  seedTrialBookings,
  seedNotificationPreferences,
  seedNotificationLog,
  seedPromotions,
  seedClientDocuments,
  seedReferralRewards,
} from "./seed";
import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];

export type Store = {
  profiles: Tables["profiles"]["Row"][];
  clients: Tables["clients"]["Row"][];
  bonos: Tables["bonos"]["Row"][];
  reservations: Tables["reservations"]["Row"][];
  payments: Tables["payments"]["Row"][];
  services: Tables["services"]["Row"][];
  exercise_categories: Tables["exercise_categories"]["Row"][];
  exercises: Tables["exercises"]["Row"][];
  exercise_progress: Tables["exercise_progress"]["Row"][];
  announcements: Tables["announcements"]["Row"][];
  client_exercises: Tables["client_exercises"]["Row"][];
  availability_rules: Tables["availability_rules"]["Row"][];
  availability_blocks: Tables["availability_blocks"]["Row"][];
  consents: Tables["consents"]["Row"][];
  data_access_log: Tables["data_access_log"]["Row"][];
  trial_bookings: Tables["trial_bookings"]["Row"][];
  notification_preferences: Tables["notification_preferences"]["Row"][];
  notification_log: Tables["notification_log"]["Row"][];
  promotions: Tables["promotions"]["Row"][];
  client_documents: Tables["client_documents"]["Row"][];
  referral_rewards: Tables["referral_rewards"]["Row"][];
  /** OBSOLETA (0038): substituïda per service_rates. */
  professional_rates: Tables["professional_rates"]["Row"][];
  service_rates: Tables["service_rates"]["Row"][];
  bonus_service_weights: Tables["bonus_service_weights"]["Row"][];
  bonus_tiers: Tables["bonus_tiers"]["Row"][];
  bonus_worker_settings: Tables["bonus_worker_settings"]["Row"][];
  bonus_payouts: Tables["bonus_payouts"]["Row"][];
  settlements: Tables["settlements"]["Row"][];
  support_tickets: Tables["support_tickets"]["Row"][];
  polls: Tables["polls"]["Row"][];
  poll_options: Tables["poll_options"]["Row"][];
  poll_responses: Tables["poll_responses"]["Row"][];
  gift_vouchers: Tables["gift_vouchers"]["Row"][];
  booking_series: Tables["booking_series"]["Row"][];
  waitlist_entries: Tables["waitlist_entries"]["Row"][];
  professional_colors: Tables["professional_colors"]["Row"][];
  service_type_colors: Tables["service_type_colors"]["Row"][];
  centerSettings: Tables["center_settings"]["Row"] | null;
};

/**
 * Persistencia del modo simulación.
 *
 * El estado a nivel de módulo NO sobrevive entre peticiones en el App Router,
 * así que guardamos el dataset en un fichero JSON temporal. Persiste en local
 * (mientras el servidor viva) y en una instancia caliente de Vercel. Es
 * efímero a propósito: en cuanto conectes Supabase, nada de esto se usa.
 */
const FILE = path.join(os.tmpdir(), "vindibcn-mock.json");

/** Data fixa per a les llavors: el mock no ha de dependre de quan s'engega. */
const SEEDED_AT = "2026-01-01T00:00:00.000Z";

function fromSeed(): Store {
  return {
    profiles: structuredClone(seedProfiles),
    clients: structuredClone(seedClients),
    bonos: structuredClone(seedBonos),
    reservations: structuredClone(seedReservations),
    payments: structuredClone(seedPayments),
    services: structuredClone(seedServices),
    exercise_categories: structuredClone(seedExerciseCategories),
    exercises: structuredClone(seedExercises),
    exercise_progress: structuredClone(seedExerciseProgress),
    announcements: structuredClone(seedAnnouncements),
    client_exercises: structuredClone(seedClientExercises),
    availability_rules: structuredClone(seedAvailabilityRules),
    availability_blocks: [],
    consents: structuredClone(seedConsents),
    data_access_log: structuredClone(seedDataAccessLog),
    trial_bookings: structuredClone(seedTrialBookings),
    notification_preferences: structuredClone(seedNotificationPreferences),
    notification_log: structuredClone(seedNotificationLog),
    promotions: structuredClone(seedPromotions),
    client_documents: structuredClone(seedClientDocuments),
    referral_rewards: structuredClone(seedReferralRewards),
    gift_vouchers: [],
    booking_series: [],
    waitlist_entries: [],
    professional_rates: [],
    service_rates: [],
    bonus_service_weights: [],
    bonus_tiers: [],
    bonus_worker_settings: [],
    bonus_payouts: [],
    settlements: [],
    support_tickets: [],
    polls: structuredClone(seedPolls),
    poll_options: structuredClone(seedPollOptions),
    poll_responses: structuredClone(seedPollResponses),
    professional_colors: [],
    // Mateixa llavor que la migració 0046: els colors que ja feia servir el codi.
    service_type_colors: [
      { service_type: "ep_individual", color: "#642263", updated_at: SEEDED_AT },
      { service_type: "ep_parejas", color: "#965495", updated_at: SEEDED_AT },
      { service_type: "grupo_reducido", color: "#ff6d17", updated_at: SEEDED_AT },
      { service_type: "fisioterapia", color: "#1d8a8a", updated_at: SEEDED_AT },
    ],
    centerSettings: { id: true, min_cancellation_hours: 24, trainers_see_colleagues_reservations: true, referral_program_active: false, referral_reward_referee: true, referral_discount_percent: 10, opening_time: "07:00:00", closing_time: "22:00:00", min_booking_hours: 0, bono_low_threshold: 1, reminder_hour_local: 20, bono_expiry_months: null, pending_payment_cancel_enabled: false, pending_payment_cancel_hours: null, module_comunitat_enabled: true, module_sessions_prova_enabled: true, module_documents_enabled: true, gift_vouchers_enabled: true, gift_voucher_expiry_months: 12, waitlist_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  };
}

export function getStore(): Store {
  try {
    const store = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
    // Un fitxer escrit per una versió anterior no té les col·leccions noves.
    // Es reomplen des de la llavor en comptes d'enumerar-les una a una: abans
    // era una llista a mà que calia recordar d'ampliar, i la pantalla petava
    // amb un "cannot read properties of undefined" el dia que algú l'oblidava.
    // Només s'hi toca el que FALTA: un valor desat com a null es respecta.
    const seed = fromSeed() as unknown as Record<string, unknown>;
    const s = store as unknown as Record<string, unknown>;
    for (const key of Object.keys(seed))
      if (s[key] === undefined) s[key] = seed[key];
    return store;
  } catch {
    const seeded = fromSeed();
    saveStore(seeded);
    return seeded;
  }
}

export function saveStore(store: Store): void {
  try {
    fs.writeFileSync(FILE, JSON.stringify(store));
  } catch {
    // Filesystem de solo lectura (p. ej. build): se ignora.
  }
}
