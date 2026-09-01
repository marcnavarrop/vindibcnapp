import { CENTER_TZ } from "@/lib/config";
import ca from "@/messages/ca.json";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { centerDateStr } from "@/lib/center-time";
import type {
  ServiceType,
  TrainingServiceType,
  BonoStatus,
  ReservationStatus,
  PaymentMethod,
  UserRole,
  Specialty,
  SupportCategory,
  SupportStatus,
  GiftVoucherStatus,
} from "@/types/database";

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  entrenador: "Entrenador/a",
  fisioterapeuta: "Fisioterapeuta",
};

/** Días de la semana (lunes = 0), forma corta y larga. */
export const WEEKDAY_SHORT = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];
export const WEEKDAY_LONG = [
  "Dilluns",
  "Dimarts",
  "Dimecres",
  "Dijous",
  "Divendres",
  "Dissabte",
  "Diumenge",
];

/**
 * Etiquetes en CATALÀ, derivades de `messages/ca.json`.
 *
 * Les fan servir l'admin i el professional, que es queden en català fix,
 * mentre que l'àrea de client llegeix la seva versió amb `useTranslations`.
 * El text viu en un sol lloc —el diccionari— i aquí només es re-exposa amb la
 * forma d'objecte que ja esperaven totes les crides: si es copiés a mà,
 * traduir-ne una i oblidar l'altra seria qüestió de temps.
 */
export const SERVICE_LABELS: Record<ServiceType, string> = ca.labels.service;

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

/** Todos los tipos de servicio, en orden de presentación. */
export const SERVICE_TYPES: ServiceType[] = [
  "ep_individual",
  "ep_parejas",
  "grupo_reducido",
  "fisioterapia",
];

/**
 * Els serveis d'entrenament: tot menys fisioteràpia.
 *
 * Tipat `TrainingServiceType[]`, que és `Exclude<ServiceType, "fisioterapia">`.
 * El tipus no és decoració: aquesta llista estava escrita a TRES llocs i un
 * d'ells la tenia com a `ServiceType[]`, o sigui que hi cabia fisioteràpia
 * sense que ningú es queixés. El dia que s'afegeixi un servei d'entrenament
 * nou, ara peta la compilació en comptes de perdre's en silenci.
 */
export const TRAINING_SERVICES: TrainingServiceType[] = [
  "ep_individual",
  "ep_parejas",
  "grupo_reducido",
];

/**
 * Servicios que ofrece por defecto una franja según la especialidad del
 * profesional (editable en la UI): el fisio ofrece fisioterapia; el entrenador
 * (o sin especialidad) ofrece los tres servicios de entrenamiento.
 */
export function defaultServiceTypesFor(
  specialty: Specialty | null,
): ServiceType[] {
  return specialty === "fisioterapeuta" ? ["fisioterapia"] : [...TRAINING_SERVICES];
}

/** Filtra una lista de strings dejando solo tipos de servicio válidos. */
export function parseServiceTypes(values: (string | File)[]): ServiceType[] {
  return values
    .map((v) => String(v))
    .filter((v): v is ServiceType =>
      (SERVICE_TYPES as string[]).includes(v),
    );
}

/** Capacidad por defecto de una sesión de grupo reducido (para el "N/4"). */
export const GROUP_CAPACITY = 4;

export const BONO_STATUS_LABELS: Record<BonoStatus, string> = ca.labels.bonoStatus;

/**
 * "de" o "d'" segons com comenci la paraula següent.
 *
 * Fa falta perquè els noms dels serveis els tria el centre i n'hi ha que
 * comencen per vocal: "8 sessions de EP Individual" es llegia malament al val
 * imprès i al missatge de confirmació.
 */
export function deOf(word: string): string {
  return /^[aeiouàèéíòóúAEIOUÀÈÉÍÒÓÚ]/.test(word.trim())
    ? `d'${word}`
    : `de ${word}`;
}

/** "1 sessió" / "8 sessions". El plural s'escapava als correus. */
export function sessionsLabel(n: number): string {
  return `${n} ${n === 1 ? "sessió" : "sessions"}`;
}

export const GIFT_VOUCHER_STATUS_LABELS: Record<GiftVoucherStatus, string> =
  ca.labels.giftVoucherStatus;

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  bug: "Error",
  pregunta: "Pregunta",
  suggeriment: "Suggeriment",
};

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  "bug",
  "pregunta",
  "suggeriment",
];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Obert",
  in_progress: "En curs",
  resolved: "Resolt",
};

export const SUPPORT_STATUSES: SupportStatus[] = [
  "open",
  "in_progress",
  "resolved",
];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> =
  ca.labels.reservationStatus;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> =
  ca.labels.paymentMethod;

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administració",
  trainer: "Professional",
  client: "Client",
};

/**
 * Totes les funcions de format porten l'idioma com a paràmetre OPCIONAL, amb
 * el català per defecte: així les crides de l'admin i del professional no
 * canvien ni una línia, i les pantalles del client hi passen el seu.
 */

/** Formatea un importe en euros. */
export function formatEur(amount: number, locale?: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "eur",
  }).format(amount);
}

/**
 * Todo lo que se muestre al usuario va en hora del CENTRO.
 *
 * Sin `timeZone`, Intl formatea con la del proceso, y eso hace que una misma
 * fila se lea distinta según dónde se renderice: en Vercel (UTC) un instante
 * entre las 00:00 y las 02:00 de aquí cae todavía en el día anterior, y en el
 * navegador de alguien que consulte desde fuera de España, en el suyo.
 *
 * El centro es uno y está en Barcelona: la fecha de una sesión, de un cobro o
 * de una factura es la de aquí, la mire quien la mire y desde donde la mire.
 *
 * Las columnas `date` (períodos de liquidación, vigencia de tarifas,
 * caducidad de bonos) no se ven afectadas: llegan como "YYYY-MM-DD", se
 * parsean como medianoche UTC y el desplazamiento de Madrid es siempre
 * positivo, así que caen en el mismo día con y sin esto.
 */
const CENTER_DATE_PARTS = { timeZone: CENTER_TZ } as const;

/** Formatea una fecha ISO en formato corto. */
export function formatDate(iso: string, locale?: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...CENTER_DATE_PARTS,
  }).format(new Date(iso));
}

/** Hora (HH:mm) de una fecha ISO. */
export function formatTime(iso: string, locale?: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    ...CENTER_DATE_PARTS,
  }).format(new Date(iso));
}

/** Mes abreujat ("ag.", "set."), per als calendaris compactes. */
export function formatMonthShort(iso: string, locale?: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    ...CENTER_DATE_PARTS,
  }).format(new Date(iso));
}

/** Cabecera de día: "dilluns, 22 de juny". */
export function formatDayHeading(iso: string, locale?: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...CENTER_DATE_PARTS,
  }).format(new Date(iso));
}

/**
 * Clave de día (YYYY-MM-DD) para agrupar, en hora del centro.
 *
 * Con `toISOString()` una sesión de madrugada se agrupaba bajo el día
 * anterior, porque esa es su fecha en UTC.
 */
export function dayKey(iso: string): string {
  return centerDateStr(new Date(iso));
}

/**
 * Fecha larga en catalán con la inicial en mayúscula (p. ej. "Dimecres, 25 de juny").
 *
 * En hora del CENTRO, no la del proceso: es la cabecera "hoy" de los dos
 * inicios, que se renderiza en el servidor (UTC). Entre medianoche y las 2 h
 * de aquí, en UTC todavía es el día anterior, y la cabecera contradecía a los
 * KPI de debajo —que sí cuentan por día del centro— diciendo "ahir" mientras
 * la tarjeta contaba las sesiones de hoy.
 */
export function formatLongDate(date: Date, locale?: Locale): string {
  const s = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...CENTER_DATE_PARTS,
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
