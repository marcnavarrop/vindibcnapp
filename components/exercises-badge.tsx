"use client";

import { useTranslations } from "next-intl";
import { NavBadge } from "@/components/ui/nav-badge";
import { useBadgeEvent } from "@/lib/badge-store";
import { EXERCISES_SEEN, type ExercisesSeenDetail } from "@/lib/exercise-events";

/**
 * La piloteta d'«Exercicis» al menú del client: què li han posat i no ha vist.
 *
 * Compta les assignacions posteriors a l'última visita seva a la pantalla
 * (`exercises_seen`, 0089). Fins ara no hi havia manera de saber-ho i el buit
 * es tapava a mà, amb un botó que envia un correu de "tens exercicis nous":
 * l'avís depenia que algú se'n recordés i vivia fora de l'app.
 *
 * ÉS DE LA FAMÍLIA DE COMUNITAT, NO DE LA DE BONS
 *
 * S'apaga PER SEMPRE en mirar-la, perquè un exercici que ja has vist deixa de
 * ser nou. Un bo sense pagar, en canvi, segueix sense pagar per molt que
 * l'hagis mirat, i per això aquella només se silencia mentre hi ets. La
 * diferència és si el que reclama la piloteta s'acaba mirant-ho o fent-ho.
 *
 * La resta és el patró de sempre: el número de sortida el calcula `AppShell`
 * al servidor i ve dins de l'HTML; a partir del primer avís mana el magatzem
 * compartit, que veuen totes les còpies del menú alhora.
 */
export function ExercisesBadge({ initial }: { initial: number }) {
  const t = useTranslations("nav");

  useBadgeEvent<ExercisesSeenDetail>(
    EXERCISES_SEEN,
    "exercicis",
    (detail) => detail?.unread,
  );

  return (
    <NavBadge
      badgeKey="exercicis"
      initial={initial}
      label={(count) => t("badgeExercicis", { count })}
    />
  );
}
