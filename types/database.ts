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
  | "pending_payment";
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
export type PaymentMethod = "card" | "cash";
export type DiscountType = "percentage" | "fixed_amount";
export type PromotionScope = "service" | "package";
export type ExerciseCategory =
  | "forca"
  | "mobilitat"
  | "cardio"
  | "rehabilitacio"
  | "core";

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
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          profile_id: string;
          assigned_trainer_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          assigned_trainer_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          assigned_trainer_id?: string | null;
          notes?: string | null;
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
          created_at?: string;
        };
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
      exercises: {
        Row: {
          id: string;
          name: string;
          category: ExerciseCategory;
          description: string | null;
          video_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: ExerciseCategory;
          description?: string | null;
          video_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: ExerciseCategory;
          description?: string | null;
          video_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      measurements: {
        Row: {
          id: string;
          client_id: string;
          recorded_at: string;
          weight_kg: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          recorded_at?: string;
          weight_kg?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          recorded_at?: string;
          weight_kg?: number | null;
          notes?: string | null;
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
      notification_preferences: {
        Row: {
          id: string;
          profile_id: string;
          reservation_confirmed_email: boolean;
          reservation_confirmed_whatsapp: boolean;
          reservation_cancelled_email: boolean;
          reservation_cancelled_whatsapp: boolean;
          session_reminder_email: boolean;
          session_reminder_whatsapp: boolean;
          trial_request_email: boolean;
          trial_request_whatsapp: boolean;
          trial_status_email: boolean;
          trial_status_whatsapp: boolean;
          bono_low_email: boolean;
          bono_low_whatsapp: boolean;
          community_email: boolean;
          community_whatsapp: boolean;
          trainer_booking_received_email: boolean;
          trainer_booking_received_whatsapp: boolean;
          trainer_booking_cancelled_email: boolean;
          trainer_booking_cancelled_whatsapp: boolean;
          trainer_daily_agenda_email: boolean;
          trainer_daily_agenda_whatsapp: boolean;
          new_client_registered_email: boolean;
          new_client_registered_whatsapp: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          reservation_confirmed_email?: boolean;
          reservation_confirmed_whatsapp?: boolean;
          reservation_cancelled_email?: boolean;
          reservation_cancelled_whatsapp?: boolean;
          session_reminder_email?: boolean;
          session_reminder_whatsapp?: boolean;
          trial_request_email?: boolean;
          trial_request_whatsapp?: boolean;
          trial_status_email?: boolean;
          trial_status_whatsapp?: boolean;
          bono_low_email?: boolean;
          bono_low_whatsapp?: boolean;
          community_email?: boolean;
          community_whatsapp?: boolean;
          trainer_booking_received_email?: boolean;
          trainer_booking_received_whatsapp?: boolean;
          trainer_booking_cancelled_email?: boolean;
          trainer_booking_cancelled_whatsapp?: boolean;
          trainer_daily_agenda_email?: boolean;
          trainer_daily_agenda_whatsapp?: boolean;
          new_client_registered_email?: boolean;
          new_client_registered_whatsapp?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          profile_id: string;
          reservation_confirmed_email: boolean;
          reservation_confirmed_whatsapp: boolean;
          reservation_cancelled_email: boolean;
          reservation_cancelled_whatsapp: boolean;
          session_reminder_email: boolean;
          session_reminder_whatsapp: boolean;
          trial_request_email: boolean;
          trial_request_whatsapp: boolean;
          trial_status_email: boolean;
          trial_status_whatsapp: boolean;
          bono_low_email: boolean;
          bono_low_whatsapp: boolean;
          community_email: boolean;
          community_whatsapp: boolean;
          trainer_booking_received_email: boolean;
          trainer_booking_received_whatsapp: boolean;
          trainer_booking_cancelled_email: boolean;
          trainer_booking_cancelled_whatsapp: boolean;
          trainer_daily_agenda_email: boolean;
          trainer_daily_agenda_whatsapp: boolean;
          new_client_registered_email: boolean;
          new_client_registered_whatsapp: boolean;
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
          starts_at?: string;
          ends_at?: string;
          active?: boolean;
          created_at?: string;
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
      center_settings: {
        Row: {
          id: boolean;
          min_cancellation_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          min_cancellation_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          min_cancellation_hours?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_role: { Args: Record<never, never>; Returns: UserRole };
      is_admin: { Args: Record<never, never>; Returns: boolean };
      owns_client: { Args: { cid: string }; Returns: boolean };
      is_trainer_of: { Args: { cid: string }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      service_type: ServiceType;
      bono_status: BonoStatus;
      reservation_status: ReservationStatus;
      trial_status: TrialStatus;
      payment_method: PaymentMethod;
      exercise_category: ExerciseCategory;
      discount_type: DiscountType;
      promotion_scope: PromotionScope;
    };
    CompositeTypes: Record<never, never>;
  };
}
