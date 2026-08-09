import { NEUTRAL_PRO_COLOR } from "@/lib/pro-colors";
import type { ServiceType } from "@/types/database";

/**
 * Paleta del centre, ja resolta.
 *
 * Es carrega UN cop per pàgina al servidor i baixa sencera als components de
 * client com una prop. No hi ha cap consulta per cel·la del calendari: quan
 * arriba aquí, cada professional i cada tipus de servei ja tenen el seu color
 * decidit (el desat per l'admin o el de la paleta per defecte).
 *
 * Aquest fitxer no toca la base de dades a propòsit —els components de client
 * l'importen—; les lectures i escriptures viuen a `lib/data/colors.ts`.
 */
export type ColorPalette = {
  /** Tots els professionals del centre, ja resolts. */
  pros: Record<string, string>;
  /** Els quatre tipus de servei, ja resolts. */
  services: Record<ServiceType, string>;
};

/** Color d'un professional. Gris neutre si la reserva no en té cap. */
export function colorOfPro(
  palette: ColorPalette,
  trainerId: string | null,
): string {
  if (!trainerId) return NEUTRAL_PRO_COLOR;
  return palette.pros[trainerId] ?? NEUTRAL_PRO_COLOR;
}

/** Color d'un tipus de servei. */
export function colorOfService(
  palette: ColorPalette,
  serviceType: ServiceType,
): string {
  return palette.services[serviceType];
}
