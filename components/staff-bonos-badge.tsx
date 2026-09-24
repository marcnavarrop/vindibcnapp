"use client";

import { NavBadge } from "@/components/ui/nav-badge";
import { useBadgeEvent } from "@/lib/badge-store";
import {
  BONOS_COLLECTABLE,
  type BonosCollectableDetail,
} from "@/lib/bono-events";

/**
 * La piloteta de «Bons» al menú de l'admin i del professional: quants bons de
 * tot el centre queden per cobrar (pendents i decaiguts per impagament).
 *
 * Mateix patró que les del client —número de sortida calculat per `AppShell`,
 * magatzem compartit per a les dues còpies del menú—, però amb una altra
 * semàntica: aquí NO se silencia en mirar-la. És una cua de feina, com la de
 * suport, i ha de dir el número de debò fins que algú cobri o anul·li. Qui la
 * fa baixar és `CollectableBonosAnnouncer`, a la taula de bons.
 *
 * Etiqueta en català fix: l'admin i el professional no tenen diccionari.
 */
export function StaffBonosBadge({ initial }: { initial: number }) {
  useBadgeEvent<BonosCollectableDetail>(
    BONOS_COLLECTABLE,
    "staffBonos",
    (detail) => detail?.collectable,
  );

  return (
    <NavBadge
      badgeKey="staffBonos"
      initial={initial}
      label={(count) => `${count} ${count === 1 ? "bo" : "bons"} per cobrar`}
    />
  );
}
