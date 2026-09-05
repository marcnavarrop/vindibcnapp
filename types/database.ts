/**
 * Tipos de la base de datos.
 *
 * ⚠️ Por ahora están escritos a mano para que coincidan con
 * `supabase/migrations/0001_initial_schema.sql`. En cuanto haya un proyecto
 * Supabase real, regenéralos con:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * (o `--local` si usas la CLI con Docker). Ver README.
 */

export type UserRole = "admin" | "trainer" | "client";
export type Specialty = "entrenador" | "fisioterapeuta";

export type SupportCategory = "bug" | "pregunta" | "suggeriment";
export type SupportStatus = "open" | "in_progress" | "resolved";
export type PreferredLanguage = "ca" | "es" | "en";
export type Gender = "home" | "dona" | "altre" | "ns_nc";
export type ServiceType =
  | "ep_individual"
  | "ep_parejas"
  | "grupo_reducido"
  | "fisioterapia";
export type BonoStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "pending_payment"
  /** Va caducar amb sessions sense fer. No és el mateix que 'completed'. */
  | "expired"
  /** Anul·lat perquè no es va cobrar dins del termini. */
  | "unpaid";
/**
 * Estat d'un val de regal.
 *
 * A diferència d'un bo, 'pending_payment' aquí NO és utilitzable: qui bescanvia
 * pot ser algú sense cap relació amb el pagament, així que el val no val res
 * fins que el centre confirma que l'ha cobrat.
 */
export type GiftVoucherStatus =
  | "pending_payment"
  | "active"
  | "redeemed"
  | "expired"
  | "cancelled";
/** Cada quant es repeteix una sèrie de reserves. */
export type BookingFrequency = "weekly" | "biweekly" | "monthly";

/**
 * Com ha acabat una sèrie.
 *
 * 'completed' vol dir que el temps li ha passat per sobre (totes les
 * ocurrències són al passat), no que el client hi hagi fet res: la diferència
 * amb 'cancelled' és justament aquesta.
 */
export type BookingSeriesStatus = "active" | "cancelled" | "completed";

/** Estat d'una entrada a la llista d'espera. */
export type WaitlistStatus = "waiting" | "fulfilled" | "expired" | "cancelled";

/**
 * Què ha passat en intentar agafar una plaça de grup (funció `book_group_slot`).
 *
 * 'taken' = la franja se l'ha quedada una sessió que no és de grup;
 * 'full' = ja hi ha l'aforament sencer; 'no_sessions' = el bo ha canviat sota
 * els peus de qui el va llegir i el reclam optimista no ha entrat.
 */
export type GroupBookingResult =
  /** `remaining` és null quan la reserva és de cortesia: no hi ha cap bo que comptar (0070). */
  | { ok: true; id: string; remaining: number | null }
  | { ok: false; reason: "taken" | "full" | "no_sessions" };

/**
 * Estat d'una subscripció mensual (0072).
 *
 * Tres i no quatre: 'past_due' ja vol dir "aturada fins que pagui". Un 'paused'
 * a part seria el mateix estat amb dos noms.
 */
export type SubscriptionStatus = "active" | "past_due" | "cancelled";

/**
 * Què ha passat en intentar reclamar una sessió extra (`claim_subscription_extra`).
 *
 * 'stale_cycle' = qui la demana llegia una pantalla d'abans de la renovació;
 * 'sessions_left' = encara li'n queden del cicle, i un extra només es demana
 * amb el cicle exhaurit; 'limit_reached' = ja ha gastat la quota del mes.
 */
export type SubscriptionExtraResult =
  | { ok: true; id: string; used: number }
  | { ok: false; reason: "not_found" | "not_active" | "stale_cycle" | "limit_reached" }
  | { ok: false; reason: "sessions_left"; remaining: number };

export type ReferralRewardStatus = "pending" | "used" | "expired";
export type ReservationStatus = "booked" | "completed" | "cancelled";
export type TrialStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "completed"
  | "no_show"
  | "cancelled";
/** Serveis d'entrenament (les sessions de prova mai són de fisioteràpia). */
export type TrainingServiceType = Exclude<ServiceType, "fisioterapia">;

/**
 * Línia del desglossament d'una liquidació, tal com es desa a
 * `settlements.session_breakdown`. És una fotografia: un cop generada, no es
 * torna a calcular encara que canviïn les tarifes.
 */
export type SettlementBreakdownLine = {
  serviceType: ServiceType;
  sessions: number;
  /** Tarifa aplicada. `null` si dins d'aquest tipus hi va haver més d'una. */
  rate: number | null;
  amount: number;
};
export type BonusPayoutFrequency = "annual" | "biennial";

/**
 * Tram aplicat en un bonus, tal com es desa a `bonus_payouts.tier_breakdown`.
 * És una fotografia: no es recalcula encara que després canviïn els trams.
 */
export type BonusTierLine = {
  minUnits: number;
  maxUnits: number | null;
  ratePerUnit: number;
  /** Unitats del total que han caigut dins d'aquest tram. */
  unitsInTier: number;
  amount: number;
};
export type PaymentMethod = "card" | "cash";
export type DiscountType = "percentage" | "fixed_amount";
export type PromotionScope = "service" | "package";
/**
 * A qui arriba una oferta.
 *
 * 'all' és el comportament de sempre. 'tag' i 'active_bono' són segments: la
 * decisió de si una oferta hi arriba viu en un sol lloc (`reachesAudience`, a
 * lib/data/promotions.ts) i no s'ha de repetir enlloc més.
 */
export type PromotionAudience = "all" | "tag" | "active_bono";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          role: UserRole;
          specialty: Specialty | null;
          preferred_language: PreferredLanguage;
          birth_date: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          gender: Gender | null;
          emergency_contact: string | null;
          objective: string | null;
          avatar_path: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
          specialty?: Specialty | null;
          preferred_language?: PreferredLanguage;
          birth_date?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          gender?: Gender | null;
          emergency_contact?: string | null;
          objective?: string | null;
          avatar_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
          specialty?: Specialty | null;
          preferred_language?: PreferredLanguage;
          birth_date?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          gender?: Gender | null;
          emergency_contact?: string | null;
          objective?: string | null;
          avatar_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          profile_id: string;
          assigned_trainer_id: string | null;
          clinical_notes: string | null;
          general_notes: string | null;
          referral_code: string | null;
          referred_by_client_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          assigned_trainer_id?: string | null;
          clinical_notes?: string | null;
          general_notes?: string | null;
          referral_code?: string | null;
          referred_by_client_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          assigned_trainer_id?: string | null;
          clinical_notes?: string | null;
          general_notes?: string | null;
          referral_code?: string | null;
          referred_by_client_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bonos: {
        Row: {
          id: string;
          client_id: string;
          service_type: ServiceType;
          total_sessions: number;
          remaining_sessions: number;
          price: number;
          status: BonoStatus;
          purchased_at: string;
          expires_at: string | null;
          first_reservation_at: string | null;
          gift_voucher_id: string | null;
          stripe_checkout_session_id: string | null;
          subscription_id: string | null;
          subscription_cycle_start: string | null;
          is_subscription_extra: boolean;
          stripe_invoice_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          service_type: ServiceType;
          total_sessions: number;
          remaining_sessions: number;
          price: number;
          status?: BonoStatus;
          purchased_at?: string;
          expires_at?: string | null;
          first_reservation_at?: string | null;
          gift_voucher_id?: string | null;
          stripe_checkout_session_id?: string | null;
          subscription_id?: string | null;
          subscription_cycle_start?: string | null;
          is_subscription_extra?: boolean;
          stripe_invoice_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          service_type?: ServiceType;
          total_sessions?: number;
          remaining_sessions?: number;
          price?: number;
          status?: BonoStatus;
          purchased_at?: string;
          expires_at?: string | null;
          first_reservation_at?: string | null;
          gift_voucher_id?: string | null;
          stripe_checkout_session_id?: string | null;
          subscription_id?: string | null;
          subscription_cycle_start?: string | null;
          is_subscription_extra?: boolean;
          stripe_invoice_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          client_id: string;
          service_id: string;
          service_type: ServiceType;
          sessions_per_cycle: number;
          package_name: string;
          /** Preu del cicle, congelat a l'alta. No es torna a cotitzar mai. */
          unit_price: number;
          payment_method: PaymentMethod;
          status: SubscriptionStatus;
          /** Dia del mes de la renovació (1–31), retallat als mesos curts. */
          anchor_day: number;
          started_on: string;
          current_cycle_start: string;
          /** Null només quan status='cancelled'. */
          next_renewal_on: string | null;
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          service_id: string;
          service_type: ServiceType;
          sessions_per_cycle: number;
          package_name: string;
          unit_price: number;
          payment_method: PaymentMethod;
          status?: SubscriptionStatus;
          anchor_day: number;
          started_on: string;
          current_cycle_start: string;
          next_renewal_on?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          service_id?: string;
          sessions_per_cycle?: number;
          package_name?: string;
          unit_price?: number;
          status?: SubscriptionStatus;
          anchor_day?: number;
          current_cycle_start?: string;
          next_renewal_on?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gift_vouchers: {
        Row: {
          id: string;
          code: string;
          service_id: string;
          buyer_client_id: string;
          recipient_name: string | null;
          recipient_email: string | null;
          message: string | null;
          price: number;
          service_type: ServiceType;
          total_sessions: number;
          package_name: string;
          purchased_at: string;
          expires_at: string;
          status: GiftVoucherStatus;
          redeemed_at: string | null;
          redeemed_by_client_id: string | null;
          redeemed_bono_id: string | null;
          pdf_path: string | null;
          stripe_checkout_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          service_id: string;
          buyer_client_id: string;
          recipient_name?: string | null;
          recipient_email?: string | null;
          message?: string | null;
          price: number;
          service_type: ServiceType;
          total_sessions: number;
          package_name: string;
          purchased_at?: string;
          expires_at: string;
          status?: GiftVoucherStatus;
          redeemed_at?: string | null;
          redeemed_by_client_id?: string | null;
          redeemed_bono_id?: string | null;
          pdf_path?: string | null;
          stripe_checkout_session_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          service_id?: string;
          buyer_client_id?: string;
          recipient_name?: string | null;
          recipient_email?: string | null;
          message?: string | null;
          price?: number;
          service_type?: ServiceType;
          total_sessions?: number;
          package_name?: string;
          purchased_at?: string;
          expires_at?: string;
          status?: GiftVoucherStatus;
          redeemed_at?: string | null;
          redeemed_by_client_id?: string | null;
          redeemed_bono_id?: string | null;
          pdf_path?: string | null;
          stripe_checkout_session_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      booking_series: {
        Row: {
          id: string;
          client_id: string;
          bono_id: string | null;
          service_type: ServiceType;
          base_trainer_id: string | null;
          frequency: BookingFrequency;
          end_date: string | null;
          occurrence_count: number | null;
          book_only_available: boolean;
          allow_alternatives: boolean;
          allow_waitlist: boolean;
          status: BookingSeriesStatus;
          first_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          bono_id?: string | null;
          service_type: ServiceType;
          base_trainer_id?: string | null;
          frequency: BookingFrequency;
          end_date?: string | null;
          occurrence_count?: number | null;
          book_only_available?: boolean;
          allow_alternatives?: boolean;
          allow_waitlist?: boolean;
          status?: BookingSeriesStatus;
          first_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          client_id: string;
          bono_id: string | null;
          service_type: ServiceType;
          base_trainer_id: string | null;
          frequency: BookingFrequency;
          end_date: string | null;
          occurrence_count: number | null;
          book_only_available: boolean;
          allow_alternatives: boolean;
          allow_waitlist: boolean;
          status: BookingSeriesStatus;
          first_at: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          id: string;
          client_id: string;
          bono_id: string | null;
          service_type: ServiceType;
          trainer_id: string | null;
          desired_date: string;
          desired_time: string;
          series_id: string | null;
          status: WaitlistStatus;
          created_at: string;
          fulfilled_at: string | null;
          fulfilled_reservation_id: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          bono_id?: string | null;
          service_type: ServiceType;
          trainer_id?: string | null;
          desired_date: string;
          desired_time: string;
          series_id?: string | null;
          status?: WaitlistStatus;
          created_at?: string;
          fulfilled_at?: string | null;
          fulfilled_reservation_id?: string | null;
        };
        Update: Partial<{
          id: string;
          client_id: string;
          bono_id: string | null;
          service_type: ServiceType;
          trainer_id: string | null;
          desired_date: string;
          desired_time: string;
          series_id: string | null;
          status: WaitlistStatus;
          created_at: string;
          fulfilled_at: string | null;
          fulfilled_reservation_id: string | null;
        }>;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          client_id: string;
          bono_id: string | null;
          trainer_id: string | null;
          scheduled_at: string;
          service_type: ServiceType;
          status: ReservationStatus;
          series_id: string | null;
          is_complimentary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          bono_id?: string | null;
          trainer_id?: string | null;
          scheduled_at: string;
          service_type: ServiceType;
          status?: ReservationStatus;
          series_id?: string | null;
          is_complimentary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          bono_id?: string | null;
          trainer_id?: string | null;
          scheduled_at?: string;
          service_type?: ServiceType;
          status?: ReservationStatus;
          series_id?: string | null;
          is_complimentary?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          client_id: string | null;
          bono_id: string | null;
          stripe_payment_id: string | null;
          amount: number;
          currency: string;
          method: PaymentMethod;
          concept: string | null;
          paid_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          bono_id?: string | null;
          stripe_payment_id?: string | null;
          amount: number;
          currency?: string;
          method: PaymentMethod;
          concept?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          bono_id?: string | null;
          stripe_payment_id?: string | null;
          amount?: number;
          currency?: string;
          method?: PaymentMethod;
          concept?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          service_type: ServiceType;
          name: string;
          price: number;
          default_sessions: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_type: ServiceType;
          name: string;
          price: number;
          default_sessions?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_type?: ServiceType;
          name?: string;
          price?: number;
          default_sessions?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      exercise_categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          category: string;
          description: string | null;
          video_url: string | null;
          video_file_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          description?: string | null;
          video_url?: string | null;
          video_file_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          description?: string | null;
          video_url?: string | null;
          video_file_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exercise_progress: {
        Row: {
          id: string;
          client_exercise_id: string;
          recorded_at: string;
          weight_kg: number;
          reps: number | null;
          notes: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_exercise_id: string;
          recorded_at?: string;
          weight_kg: number;
          reps?: number | null;
          notes?: string | null;
          recorded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_exercise_id?: string;
          recorded_at?: string;
          weight_kg?: number;
          reps?: number | null;
          notes?: string | null;
          recorded_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          author_id: string | null;
          title: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string | null;
          title: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string | null;
          title?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      data_access_log: {
        Row: {
          id: string;
          actor_id: string | null;
          subject_profile_id: string | null;
          subject_label: string | null;
          action: "export" | "delete";
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          subject_profile_id?: string | null;
          subject_label?: string | null;
          action: "export" | "delete";
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          subject_profile_id?: string | null;
          subject_label?: string | null;
          action?: "export" | "delete";
          details?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          id: string;
          user_id: string;
          type: "privacy" | "health_data";
          version: string;
          granted_at: string;
          ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "privacy" | "health_data";
          version: string;
          granted_at?: string;
          ip?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "privacy" | "health_data";
          version?: string;
          granted_at?: string;
          ip?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      availability_rules: {
        Row: {
          id: string;
          trainer_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          valid_from: string;
          valid_until: string | null;
          service_types: ServiceType[];
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          valid_from?: string;
          valid_until?: string | null;
          service_types?: ServiceType[];
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          weekday?: number;
          start_time?: string;
          end_time?: string;
          valid_from?: string;
          valid_until?: string | null;
          service_types?: ServiceType[];
          created_at?: string;
        };
        Relationships: [];
      };
      availability_blocks: {
        Row: {
          id: string;
          trainer_id: string;
          start_at: string;
          end_at: string;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          start_at: string;
          end_at: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          start_at?: string;
          end_at?: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      // La 0072 hi va afegir `subscription_renewed_email`,
      // `subscription_payment_failed_email` i `subscription_cancelled_email`.
      // Encara no hi són aquí a posta: en aquest projecte un avís és una unitat
      // de tres peces —columna, tipus d'esdeveniment i plantilla— i
      // `PREFERENCE_KEYS` es deriva dels tipus, no de la taula. Tipar la
      // columna sense el seu esdeveniment només aconsegueix que el literal del
      // mock deixi de quadrar. Entren juntes amb els avisos.
      notification_preferences: {
        Row: {
          id: string;
          profile_id: string;
          reservation_confirmed_email: boolean;
          reservation_cancelled_email: boolean;
          session_reminder_email: boolean;
          trial_request_email: boolean;
          trial_status_email: boolean;
          bono_low_email: boolean;
          community_email: boolean;
          trainer_booking_received_email: boolean;
          trainer_booking_cancelled_email: boolean;
          trainer_daily_agenda_email: boolean;
          waitlist_fulfilled_email: boolean;
          gift_voucher_redeemed_email: boolean;
          new_client_registered_email: boolean;
          new_exercises_assigned_email: boolean;
          bono_expiring_soon_email: boolean;
          bono_unpaid_cancelled_email: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          reservation_confirmed_email?: boolean;
          reservation_cancelled_email?: boolean;
          session_reminder_email?: boolean;
          trial_request_email?: boolean;
          trial_status_email?: boolean;
          bono_low_email?: boolean;
          community_email?: boolean;
          trainer_booking_received_email?: boolean;
          trainer_booking_cancelled_email?: boolean;
          trainer_daily_agenda_email?: boolean;
          waitlist_fulfilled_email?: boolean;
          gift_voucher_redeemed_email?: boolean;
          new_client_registered_email?: boolean;
          new_exercises_assigned_email?: boolean;
          bono_expiring_soon_email?: boolean;
          bono_unpaid_cancelled_email?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          profile_id: string;
          reservation_confirmed_email: boolean;
          reservation_cancelled_email: boolean;
          session_reminder_email: boolean;
          trial_request_email: boolean;
          trial_status_email: boolean;
          bono_low_email: boolean;
          community_email: boolean;
          trainer_booking_received_email: boolean;
          trainer_booking_cancelled_email: boolean;
          trainer_daily_agenda_email: boolean;
          waitlist_fulfilled_email: boolean;
          gift_voucher_redeemed_email: boolean;
          new_client_registered_email: boolean;
          new_exercises_assigned_email: boolean;
          bono_expiring_soon_email: boolean;
          bono_unpaid_cancelled_email: boolean;
          created_at: string;
        }>;
        Relationships: [];
      };
      notification_log: {
        Row: {
          id: string;
          profile_id: string | null;
          recipient: string | null;
          event_type: string;
          channel: string;
          status: string;
          error: string | null;
          related_id: string | null;
          provider_id: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          recipient?: string | null;
          event_type: string;
          channel: string;
          status: string;
          error?: string | null;
          related_id?: string | null;
          provider_id?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          recipient?: string | null;
          event_type?: string;
          channel?: string;
          status?: string;
          error?: string | null;
          related_id?: string | null;
          provider_id?: string | null;
          sent_at?: string;
        };
        Relationships: [];
      };
      trial_bookings: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string;
          trainer_id: string | null;
          scheduled_at: string;
          service_type: ServiceType;
          status: TrialStatus;
          expires_at: string;
          converted_client_id: string | null;
          consent_privacy_at: string;
          ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone: string;
          trainer_id?: string | null;
          scheduled_at: string;
          service_type: ServiceType;
          status?: TrialStatus;
          expires_at: string;
          converted_client_id?: string | null;
          consent_privacy_at: string;
          ip?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string;
          trainer_id?: string | null;
          scheduled_at?: string;
          service_type?: ServiceType;
          status?: TrialStatus;
          expires_at?: string;
          converted_client_id?: string | null;
          consent_privacy_at?: string;
          ip?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      promotions: {
        Row: {
          id: string;
          name: string;
          discount_type: DiscountType;
          discount_value: number;
          scope: PromotionScope;
          service_types: ServiceType[] | null;
          service_ids: string[] | null;
          audience: PromotionAudience;
          audience_tag_id: string | null;
          audience_service_type: ServiceType | null;
          starts_at: string;
          ends_at: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          discount_type: DiscountType;
          discount_value: number;
          scope: PromotionScope;
          service_types?: ServiceType[] | null;
          service_ids?: string[] | null;
          audience?: PromotionAudience;
          audience_tag_id?: string | null;
          audience_service_type?: ServiceType | null;
          starts_at: string;
          ends_at: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          discount_type?: DiscountType;
          discount_value?: number;
          scope?: PromotionScope;
          service_types?: ServiceType[] | null;
          service_ids?: string[] | null;
          audience?: PromotionAudience;
          audience_tag_id?: string | null;
          audience_service_type?: ServiceType | null;
          starts_at?: string;
          ends_at?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      client_tags: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      client_tag_assignments: {
        Row: {
          client_id: string;
          tag_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          client_id: string;
          tag_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          client_id?: string;
          tag_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Relationships: [];
      };
      client_exercises: {
        Row: {
          id: string;
          client_id: string;
          exercise_id: string;
          assigned_by: string | null;
          notes: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          exercise_id: string;
          assigned_by?: string | null;
          notes?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          exercise_id?: string;
          assigned_by?: string | null;
          notes?: string | null;
          assigned_at?: string;
        };
        Relationships: [];
      };
      client_documents: {
        Row: {
          id: string;
          client_id: string;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          file_size: number | null;
          mime_type: string | null;
          description: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          uploaded_by: string;
          storage_path: string;
          file_name: string;
          file_size?: number | null;
          mime_type?: string | null;
          description?: string | null;
          uploaded_at?: string;
        };
        Update: {
          description?: string | null;
        };
        Relationships: [];
      };
      polls: {
        Row: {
          id: string;
          question: string;
          allow_multiple: boolean;
          active: boolean;
          created_by: string | null;
          created_at: string;
          closes_at: string | null;
        };
        Insert: {
          id?: string;
          question: string;
          allow_multiple?: boolean;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          closes_at?: string | null;
        };
        Update: {
          id?: string;
          question?: string;
          allow_multiple?: boolean;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          closes_at?: string | null;
        };
        Relationships: [];
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          poll_id: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          poll_id?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      poll_responses: {
        Row: {
          id: string;
          poll_id: string;
          option_id: string;
          client_id: string;
          responded_at: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          option_id: string;
          client_id: string;
          responded_at?: string;
        };
        Update: {
          id?: string;
          poll_id?: string;
          option_id?: string;
          client_id?: string;
          responded_at?: string;
        };
        Relationships: [];
      };
      center_settings: {
        Row: {
          id: boolean;
          min_cancellation_hours: number;
          trainers_see_colleagues_reservations: boolean;
          referral_program_active: boolean;
          referral_reward_referee: boolean;
          referral_discount_percent: number;
          opening_time: string;
          closing_time: string;
          min_booking_hours: number;
          bono_low_threshold: number;
          reminder_hour_local: number;
          bono_expiry_months: number | null;
          pending_payment_cancel_enabled: boolean;
          pending_payment_cancel_hours: number | null;
          module_comunitat_enabled: boolean;
          module_sessions_prova_enabled: boolean;
          module_documents_enabled: boolean;
          gift_vouchers_enabled: boolean;
          gift_voucher_expiry_months: number;
          waitlist_enabled: boolean;
          subscriptions_enabled: boolean;
          subscription_extra_sessions_max: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          min_cancellation_hours?: number;
          trainers_see_colleagues_reservations?: boolean;
          referral_program_active?: boolean;
          referral_reward_referee?: boolean;
          referral_discount_percent?: number;
          opening_time?: string;
          closing_time?: string;
          min_booking_hours?: number;
          bono_low_threshold?: number;
          reminder_hour_local?: number;
          bono_expiry_months?: number | null;
          pending_payment_cancel_enabled?: boolean;
          pending_payment_cancel_hours?: number | null;
          module_comunitat_enabled?: boolean;
          module_sessions_prova_enabled?: boolean;
          module_documents_enabled?: boolean;
          gift_vouchers_enabled?: boolean;
          gift_voucher_expiry_months?: number;
          waitlist_enabled?: boolean;
          subscriptions_enabled?: boolean;
          subscription_extra_sessions_max?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          min_cancellation_hours?: number;
          trainers_see_colleagues_reservations?: boolean;
          referral_program_active?: boolean;
          referral_reward_referee?: boolean;
          referral_discount_percent?: number;
          opening_time?: string;
          closing_time?: string;
          min_booking_hours?: number;
          bono_low_threshold?: number;
          reminder_hour_local?: number;
          bono_expiry_months?: number | null;
          pending_payment_cancel_enabled?: boolean;
          pending_payment_cancel_hours?: number | null;
          module_comunitat_enabled?: boolean;
          module_sessions_prova_enabled?: boolean;
          module_documents_enabled?: boolean;
          gift_vouchers_enabled?: boolean;
          gift_voucher_expiry_months?: number;
          waitlist_enabled?: boolean;
          subscriptions_enabled?: boolean;
          subscription_extra_sessions_max?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      referral_rewards: {
        Row: {
          id: string;
          referrer_client_id: string;
          referee_client_id: string;
          beneficiary_client_id: string;
          discount_percent: number;
          status: ReferralRewardStatus;
          used_in_bono_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_client_id: string;
          referee_client_id: string;
          beneficiary_client_id: string;
          discount_percent: number;
          status?: ReferralRewardStatus;
          used_in_bono_id?: string | null;
          created_at?: string;
        };
        Update: {
          status?: ReferralRewardStatus;
          used_in_bono_id?: string | null;
        };
        Relationships: [];
      };
      service_rates: {
        Row: {
          id: string;
          service_type: ServiceType;
          rate_amount: number;
          effective_from: string;
          effective_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_type: ServiceType;
          rate_amount: number;
          effective_from?: string;
          effective_until?: string | null;
          created_at?: string;
        };
        Update: {
          rate_amount?: number;
          effective_from?: string;
          effective_until?: string | null;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          created_by: string;
          title: string;
          description: string;
          category: SupportCategory;
          status: SupportStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          title: string;
          description: string;
          category: SupportCategory;
          status?: SupportStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: SupportStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      professional_colors: {
        Row: {
          trainer_id: string;
          color: string;
          updated_at: string;
        };
        Insert: {
          trainer_id: string;
          color: string;
          updated_at?: string;
        };
        Update: {
          color?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_type_colors: {
        Row: {
          service_type: ServiceType;
          color: string;
          updated_at: string;
        };
        Insert: {
          service_type: ServiceType;
          color: string;
          updated_at?: string;
        };
        Update: {
          color?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bonus_service_weights: {
        Row: {
          id: string;
          service_type: ServiceType;
          weight: number;
          effective_from: string;
          effective_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_type: ServiceType;
          weight: number;
          effective_from?: string;
          effective_until?: string | null;
          created_at?: string;
        };
        Update: {
          weight?: number;
          effective_from?: string;
          effective_until?: string | null;
        };
        Relationships: [];
      };
      bonus_tiers: {
        Row: {
          id: string;
          min_units: number;
          max_units: number | null;
          rate_per_unit: number;
          frequency: BonusPayoutFrequency;
          effective_from: string;
          effective_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          min_units: number;
          max_units?: number | null;
          rate_per_unit: number;
          frequency?: BonusPayoutFrequency;
          effective_from?: string;
          effective_until?: string | null;
          created_at?: string;
        };
        Update: {
          min_units?: number;
          max_units?: number | null;
          rate_per_unit?: number;
          frequency?: BonusPayoutFrequency;
          effective_from?: string;
          effective_until?: string | null;
        };
        Relationships: [];
      };
      bonus_worker_settings: {
        Row: {
          trainer_id: string;
          payout_frequency: BonusPayoutFrequency;
          enabled: boolean;
          updated_at: string;
        };
        Insert: {
          trainer_id: string;
          payout_frequency?: BonusPayoutFrequency;
          enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          payout_frequency?: BonusPayoutFrequency;
          enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      bonus_payouts: {
        Row: {
          id: string;
          trainer_id: string;
          period_start: string;
          period_end: string;
          frequency: BonusPayoutFrequency;
          total_units: number;
          total_amount: number;
          tier_breakdown: BonusTierLine[];
          generated_at: string;
          generated_by: string | null;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          period_start: string;
          period_end: string;
          frequency: BonusPayoutFrequency;
          total_units: number;
          total_amount: number;
          tier_breakdown?: BonusTierLine[];
          generated_at?: string;
          generated_by?: string | null;
        };
        Update: {
          total_units?: number;
          total_amount?: number;
          tier_breakdown?: BonusTierLine[];
        };
        Relationships: [];
      };
      settlements: {
        Row: {
          id: string;
          trainer_id: string;
          period_start: string;
          period_end: string;
          total_amount: number;
          session_breakdown: SettlementBreakdownLine[];
          generated_at: string;
          generated_by: string | null;
          invoice_path: string | null;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          period_start: string;
          period_end: string;
          total_amount: number;
          session_breakdown?: SettlementBreakdownLine[];
          generated_at?: string;
          generated_by?: string | null;
          invoice_path?: string | null;
        };
        Update: {
          total_amount?: number;
          session_breakdown?: SettlementBreakdownLine[];
          invoice_path?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_role: { Args: Record<never, never>; Returns: UserRole };
      is_admin: { Args: Record<never, never>; Returns: boolean };
      is_trainer: { Args: Record<never, never>; Returns: boolean };
      owns_client: { Args: { cid: string }; Returns: boolean };
      is_trainer_of: { Args: { cid: string }; Returns: boolean };
      /**
       * Reserva una plaça de grup serialitzant per franja (0053). Amb
       * `p_bono_id` null la reserva és de cortesia: no descompta cap sessió,
       * però ocupa plaça igual (0070). Retorna {ok:true,id,remaining} o
       * {ok:false,reason:'taken'|'full'|'no_sessions'}.
       */
      book_group_slot: {
        Args: {
          p_client_id: string;
          /** Null = sessió de cortesia: no es descompta cap sessió (0070). */
          p_bono_id: string | null;
          p_expected_remaining: number | null;
          p_trainer_id: string;
          p_scheduled_at: string;
          p_capacity: number;
        };
        Returns: GroupBookingResult;
      };
      /**
       * Reclama una sessió extra del cicle en curs (0073). Serialitza per
       * subscripció amb un advisory lock i crea un bo d'1 sessió en
       * 'pending_payment' — també quan es pagarà amb targeta: el que es reclama
       * de manera atòmica és la PLAÇA dins de la quota, no el pagament.
       */
      claim_subscription_extra: {
        Args: {
          p_subscription_id: string;
          p_cycle_start: string;
          /** Dia del CENTRE. No es calcula a la base: la zona és configurable. */
          p_today: string;
          p_max_extras: number;
          p_price: number;
          p_expires_at: string;
        };
        Returns: SubscriptionExtraResult;
      };
      /**
       * Recompte de vots per opció d'enquesta. SECURITY DEFINER: la RLS de
       * `poll_responses` no deixa veure les respostes d'altri, i aquesta
       * funció només retorna el nombre —mai qui ha votat—. Migració 0059.
       */
      poll_option_counts: {
        Args: { p_poll_ids: string[] };
        Returns: { option_id: string; votes: number }[];
      };
    };
    Enums: {
      user_role: UserRole;
      service_type: ServiceType;
      bono_status: BonoStatus;
      reservation_status: ReservationStatus;
      trial_status: TrialStatus;
      payment_method: PaymentMethod;
      discount_type: DiscountType;
      promotion_scope: PromotionScope;
      bonus_payout_frequency: BonusPayoutFrequency;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
