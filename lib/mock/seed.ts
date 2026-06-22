/**
 * Datos semilla para el modo simulación.
 *
 * Tipados con las filas reales de la BD (`types/database`) para que, al cambiar
 * a Supabase, los datos tengan exactamente la misma forma. IDs legibles a
 * propósito (no son UUID reales, pero el tipo es `string`).
 */
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Bono = Database["public"]["Tables"]["bonos"]["Row"];
type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
type Measurement = Database["public"]["Tables"]["measurements"]["Row"];

const now = "2026-06-01T09:00:00.000Z";

export const seedProfiles: Profile[] = [
  { id: "u-admin", full_name: "Marc Navarro", email: "admin@vindibcn.com", phone: "+34 600 000 001", role: "admin", created_at: now },
  { id: "u-trainer-laia", full_name: "Laia Puig", email: "laia@vindibcn.com", phone: "+34 600 000 002", role: "trainer", created_at: now },
  { id: "u-trainer-jordi", full_name: "Jordi Soler", email: "jordi@vindibcn.com", phone: "+34 600 000 003", role: "trainer", created_at: now },
  { id: "u-client-ana", full_name: "Ana Ferrer", email: "ana@example.com", phone: "+34 600 100 001", role: "client", created_at: now },
  { id: "u-client-pau", full_name: "Pau Riera", email: "pau@example.com", phone: "+34 600 100 002", role: "client", created_at: now },
  { id: "u-client-marta", full_name: "Marta Gil", email: "marta@example.com", phone: "+34 600 100 003", role: "client", created_at: now },
  { id: "u-client-oriol", full_name: "Oriol Camps", email: "oriol@example.com", phone: "+34 600 100 004", role: "client", created_at: now },
];

export const seedClients: Client[] = [
  { id: "c-ana", profile_id: "u-client-ana", assigned_trainer_id: "u-trainer-laia", notes: "Lesió prèvia de genoll. Treballar mobilitat.", created_at: now },
  { id: "c-pau", profile_id: "u-client-pau", assigned_trainer_id: "u-trainer-laia", notes: null, created_at: now },
  { id: "c-marta", profile_id: "u-client-marta", assigned_trainer_id: "u-trainer-jordi", notes: "Prefereix horari de matí.", created_at: now },
  { id: "c-oriol", profile_id: "u-client-oriol", assigned_trainer_id: null, notes: "Pendent d'assignar entrenador/a.", created_at: now },
];

export const seedBonos: Bono[] = [
  { id: "b-1", client_id: "c-ana", service_type: "ep_individual", total_sessions: 10, remaining_sessions: 6, price: 400, status: "active", purchased_at: now, created_at: now },
  { id: "b-2", client_id: "c-ana", service_type: "fisioterapia", total_sessions: 5, remaining_sessions: 5, price: 250, status: "active", purchased_at: now, created_at: now },
  { id: "b-3", client_id: "c-pau", service_type: "grupo_reducido", total_sessions: 8, remaining_sessions: 2, price: 200, status: "active", purchased_at: now, created_at: now },
  { id: "b-4", client_id: "c-marta", service_type: "ep_parejas", total_sessions: 10, remaining_sessions: 0, price: 350, status: "completed", purchased_at: now, created_at: now },
  { id: "b-5", client_id: "c-oriol", service_type: "ep_individual", total_sessions: 5, remaining_sessions: 5, price: 220, status: "active", purchased_at: now, created_at: now },
];

export const seedReservations: Reservation[] = [
  { id: "r-1", client_id: "c-ana", bono_id: "b-1", trainer_id: "u-trainer-laia", scheduled_at: "2026-06-22T08:00:00.000Z", service_type: "ep_individual", status: "booked", created_at: now },
  { id: "r-2", client_id: "c-pau", bono_id: "b-3", trainer_id: "u-trainer-laia", scheduled_at: "2026-06-22T17:00:00.000Z", service_type: "grupo_reducido", status: "booked", created_at: now },
  { id: "r-3", client_id: "c-marta", bono_id: "b-4", trainer_id: "u-trainer-jordi", scheduled_at: "2026-06-18T09:00:00.000Z", service_type: "ep_parejas", status: "completed", created_at: now },
];

export const seedServices: Service[] = [
  { id: "s-ep-ind", service_type: "ep_individual", name: "Entrenament personal individual", price: 400, default_sessions: 10, active: true, created_at: now },
  { id: "s-ep-par", service_type: "ep_parejas", name: "Entrenament personal en parella", price: 350, default_sessions: 10, active: true, created_at: now },
  { id: "s-grup", service_type: "grupo_reducido", name: "Grup reduït", price: 200, default_sessions: 8, active: true, created_at: now },
  { id: "s-fisio", service_type: "fisioterapia", name: "Fisioteràpia", price: 250, default_sessions: 5, active: true, created_at: now },
];

export const seedExercises: Exercise[] = [
  { id: "e-esquat", name: "Esquat amb barra", category: "forca", description: "Treball de cames i glutis. Mantingues l'esquena recta.", video_url: "https://www.youtube.com/watch?v=ultWZbUMPL8", created_at: now },
  { id: "e-planxa", name: "Planxa abdominal", category: "core", description: "Manté el cos alineat 30-60 segons.", video_url: null, created_at: now },
  { id: "e-mobilitat-malucs", name: "Mobilitat de malucs", category: "mobilitat", description: "Rutina de mobilitat articular per a malucs.", video_url: null, created_at: now },
];

export const seedMeasurements: Measurement[] = [
  { id: "m-ana-1", client_id: "c-ana", recorded_at: "2026-05-01", weight_kg: 64.5, notes: "Mesura inicial.", created_at: now },
  { id: "m-ana-2", client_id: "c-ana", recorded_at: "2026-06-01", weight_kg: 63.2, notes: "Bona evolució.", created_at: now },
];

export const seedPayments: Payment[] = [
  { id: "pay-1", client_id: "c-ana", bono_id: "b-1", stripe_payment_id: null, amount: 400, currency: "eur", method: "card", paid_at: now, created_at: now },
  { id: "pay-2", client_id: "c-ana", bono_id: "b-2", stripe_payment_id: null, amount: 250, currency: "eur", method: "cash", paid_at: now, created_at: now },
  { id: "pay-3", client_id: "c-pau", bono_id: "b-3", stripe_payment_id: null, amount: 200, currency: "eur", method: "card", paid_at: now, created_at: now },
  { id: "pay-4", client_id: "c-marta", bono_id: "b-4", stripe_payment_id: null, amount: 350, currency: "eur", method: "card", paid_at: now, created_at: now },
];
