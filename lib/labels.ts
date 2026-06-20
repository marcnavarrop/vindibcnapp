import type {
  ServiceType,
  BonoStatus,
  ReservationStatus,
  PaymentMethod,
  UserRole,
} from "@/types/database";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  ep_individual: "EP Individual",
  ep_parejas: "EP Parejas",
  grupo_reducido: "Grupo reducido",
  fisioterapia: "Fisioterapia",
};

export const BONO_STATUS_LABELS: Record<BonoStatus, string> = {
  active: "Activo",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  booked: "Reservada",
  completed: "Realizada",
  cancelled: "Cancelada",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Tarjeta",
  cash: "Efectivo",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administración",
  trainer: "Entrenador",
  client: "Cliente",
};

/** Formatea un importe en euros. */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "eur",
  }).format(amount);
}

/** Formatea una fecha ISO en formato corto español. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
