import { GROUP_CAPACITY } from "@/lib/labels";

export type OccupancyStatus = "free" | "almost_full" | "full";

/**
 * Semàfor d'ocupació per a grups reduïts.
 *   free        → 1–2/4  (verd): places lliures, convida a apuntar-s'hi
 *   almost_full → 3/4    (ambre): gairebé ple, avís d'urgència
 *   full        → 4/4    (vermell fosc): complet, bloquejat
 */
export function getOccupancyStatus(count: number): OccupancyStatus {
  if (count >= GROUP_CAPACITY) return "full";
  if (count >= GROUP_CAPACITY - 1) return "almost_full";
  return "free";
}

/** Paleta de colors harmoniosa amb la identitat de marca (lila/taronja). */
export const OCCUPANCY_COLORS: Record<
  OccupancyStatus,
  { bg: string; border: string; text: string; badge: string }
> = {
  // Verd suau (tonal, no genèric Bootstrap): convida a entrar
  free: {
    bg: "#d1fae5",       // emerald-100
    border: "#10b981",   // emerald-500
    text: "#065f46",     // emerald-900
    badge: "#10b981",
  },
  // Ambre càlid: avís sense alarmar
  almost_full: {
    bg: "#fef3c7",       // amber-100
    border: "#f59e0b",   // amber-400
    text: "#78350f",     // amber-900
    badge: "#f59e0b",
  },
  // Vermell fosc / granat — "stop", clarament diferent del lila de marca
  full: {
    bg: "#fee2e2",       // red-100
    border: "#ef4444",   // red-500
    text: "#7f1d1d",     // red-900
    badge: "#ef4444",
  },
};
