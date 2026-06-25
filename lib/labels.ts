import type {
  ServiceType,
  BonoStatus,
  ReservationStatus,
  PaymentMethod,
  UserRole,
  ExerciseCategory,
  Specialty,
} from "@/types/database";

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  entrenador: "Entrenador/a",
  fisioterapeuta: "Fisioterapeuta",
};

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  forca: "Força",
  mobilitat: "Mobilitat",
  cardio: "Cardio",
  rehabilitacio: "Rehabilitació",
  core: "Core",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  ep_individual: "EP Individual",
  ep_parejas: "EP Parelles",
  grupo_reducido: "Grup reduït",
  fisioterapia: "Fisioteràpia",
};

/**
 * Color base por tipo de servicio para la vista de calendario.
 * Paleta coherente con la marca (lila/naranja) + un verde-azulado y un violeta
 * claro para distinguir los cuatro tipos. Se usa como borde y fondo tintado.
 */
export const SERVICE_COLORS: Record<ServiceType, string> = {
  ep_individual: "#642263", // lila de marca
  ep_parejas: "#965495", // lila claro
  grupo_reducido: "#ff6d17", // naranja de acento
  fisioterapia: "#1d8a8a", // verd-blau (fisio)
};

/** Capacidad por defecto de una sesión de grupo reducido (para el "N/4"). */
export const GROUP_CAPACITY = 4;

export const BONO_STATUS_LABELS: Record<BonoStatus, string> = {
  active: "Actiu",
  completed: "Completat",
  cancelled: "Cancel·lat",
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  booked: "Reservada",
  completed: "Realitzada",
  cancelled: "Cancel·lada",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Targeta",
  cash: "Efectiu",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administració",
  trainer: "Entrenador/a",
  client: "Client",
};

/** Formatea un importe en euros. */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat("ca-ES", {
    style: "currency",
    currency: "eur",
  }).format(amount);
}

/** Formatea una fecha ISO en formato corto. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Hora (HH:mm) de una fecha ISO. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Cabecera de día: "dilluns, 22 de juny". */
export function formatDayHeading(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** Clave de día (YYYY-MM-DD) para agrupar. */
export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Fecha larga en catalán con la inicial en mayúscula (p. ej. "Dimecres, 25 de juny"). */
export function formatLongDate(date: Date): string {
  const s = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
