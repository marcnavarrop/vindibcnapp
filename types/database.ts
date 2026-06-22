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
export type ServiceType =
  | "ep_individual"
  | "ep_parejas"
  | "grupo_reducido"
  | "fisioterapia";
export type BonoStatus = "active" | "completed" | "cancelled";
export type ReservationStatus = "booked" | "completed" | "cancelled";
export type PaymentMethod = "card" | "cash";
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
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
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
          client_id: string;
          bono_id: string | null;
          stripe_payment_id: string | null;
          amount: number;
          currency: string;
          method: PaymentMethod;
          paid_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          bono_id?: string | null;
          stripe_payment_id?: string | null;
          amount: number;
          currency?: string;
          method: PaymentMethod;
          paid_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          bono_id?: string | null;
          stripe_payment_id?: string | null;
          amount?: number;
          currency?: string;
          method?: PaymentMethod;
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
      payment_method: PaymentMethod;
      exercise_category: ExerciseCategory;
    };
    CompositeTypes: Record<never, never>;
  };
}
