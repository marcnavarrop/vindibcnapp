"use client";

import { useEffect, useState } from "react";
import { unreadCommunityCountAction } from "@/lib/actions/community";
import { COMMUNITY_SEEN, type CommunitySeenDetail } from "@/lib/community-events";

/**
 * La piloteta de «Comunitat» al menú del client.
 *
 * ES DEMANA EL NÚMERO ELLA MATEIXA
 *
 * No li arriba com a prop des de `AppShell`, i no és per comoditat: `AppShell`
 * és el layout i NO es torna a renderitzar en navegar entre pantalles del
 * client. Un número passat des d'allà es quedaria ranci exactament com li va
 * passar a la piloteta de suport, que és d'on surt aquest patró.
 *
 * La consulta és un recompte sense files (`head: true` al servidor) i es fa un
 * cop en muntar-se el menú, que és una sola vegada per càrrega.
 *
 * I S'APAGA SENSE RECARREGAR
 *
 * Escoltant `vindi:community-seen`, que llança el marcador de la pàgina de
 * Comunitat amb el número nou a dins. Sense això caldria recarregar per veure
 * que ja no queda res, havent-ho acabat de mirar.
 *
 * Un `unread` negatiu vol dir que el marcatge ha fallat: es deixa el número com
 * estava en comptes d'apagar-la mentint.
 */
export function CommunityBadge() {
  /** `null` mentre no se sap. Amb 0 no es pinta res. */
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    unreadCommunityCountAction().then(setUnread, () => setUnread(null));
  }, []);

  useEffect(() => {
    const onSeen = (e: Event) => {
      const detail = (e as CustomEvent<CommunitySeenDetail>).detail;
      if (typeof detail?.unread === "number" && detail.unread >= 0)
        setUnread(detail.unread);
    };
    window.addEventListener(COMMUNITY_SEEN, onSeen);
    return () => window.removeEventListener(COMMUNITY_SEEN, onSeen);
  }, []);

  if (unread === null || unread <= 0) return null;

  return (
    <span
      // Taronja de marca sobre el lila del menú: el mateix contrast que fa
      // servir la vora de l'entrada activa. Els tons `brand-*-dark` d'aquí no
      // es veurien.
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white"
      aria-label={`${unread} ${unread === 1 ? "novetat" : "novetats"}`}
    >
      {unread > 9 ? "9+" : unread}
    </span>
  );
}
