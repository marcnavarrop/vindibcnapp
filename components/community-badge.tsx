"use client";

import { useTranslations } from "next-intl";
import { NavBadge } from "@/components/ui/nav-badge";
import { useBadgeEvent } from "@/lib/badge-store";
import { COMMUNITY_SEEN, type CommunitySeenDetail } from "@/lib/community-events";

/**
 * La piloteta de «Comunitat» al menú del client.
 *
 * EL NÚMERO DE SORTIDA VE DEL SERVIDOR
 *
 * Ja no se'l demana ella en muntar-se. El calcula `AppShell` durant el render
 * i baixa com a prop, o sigui que viatja dins de l'HTML i es pinta al primer
 * frame en comptes dels 999 ms que trigava.
 *
 * Això NO reprodueix el número ranci que ens va mossegar dues vegades avui.
 * Aquell venia de guardar la prop com a ESTAT d'una piloteta concreta: com
 * que `AppShell` és el layout i no es torna a renderitzar en navegar, el
 * número es quedava clavat. Aquí la prop és només el valor de SORTIDA del
 * magatzem compartit (`lib/badge-store`); a partir del primer avís mana el
 * magatzem, i el magatzem el veuen totes les còpies del menú alhora.
 *
 * I S'APAGA SENSE RECARREGAR
 *
 * Escoltant `vindi:community-seen`, que llança el marcador de la pàgina de
 * Comunitat amb el número nou a dins. Un `unread` negatiu vol dir que el
 * marcatge ha fallat: el magatzem l'ignora i la deixa com estava en comptes
 * d'apagar-la mentint.
 */
export function CommunityBadge({ initial }: { initial: number }) {
  const t = useTranslations("nav");

  useBadgeEvent<CommunitySeenDetail>(
    COMMUNITY_SEEN,
    "community",
    (detail) => detail?.unread,
  );

  return (
    <NavBadge
      badgeKey="community"
      initial={initial}
      // En català, castellà i anglès: el menú del client va traduït sencer i
      // aquesta etiqueta se la menja un lector de pantalla. Fins ara deia
      // "novetats" a tothom, que és el mateix descuit que ja es va arreglar
      // amb l'etiqueta de l'àrea.
      label={(count) => t("badgeCommunity", { count })}
    />
  );
}
