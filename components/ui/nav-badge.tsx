"use client";

import { useBadgeCount, type BadgeKey } from "@/lib/badge-store";

/**
 * La piloteta d'una entrada del menú: el número i prou.
 *
 * NO ES DEMANA RES A ELLA MATEIXA, I AIXÒ ÉS EL CANVI
 *
 * Abans cada piloteta cridava una Server Action en muntar-se, i el número
 * arribava quan arribava: mesurat en mòbil, 999 ms des que s'obre el menú
 * fins que apareix. I com que del menú n'hi ha dues còpies muntades alhora
 * (l'`<aside>` amagat i el calaix), obrir el menú tornava a disparar totes
 * dues peticions cada vegada.
 *
 * Ara el número el calcula `AppShell` durant el render de servidor i baixa
 * com a `initial`: ja ve dins de l'HTML, així que es pinta al primer frame.
 * El que el manté al dia durant la sessió segueix sent el mateix de sempre
 * —els avisos per `window`—, que ara escriuen al magatzem compartit en
 * comptes de a l'estat d'una còpia concreta.
 *
 * L'ETIQUETA ARRIBA FETA DES DE FORA
 *
 * `label` és una funció i no un text perquè aquesta piloteta la fa servir
 * l'àrea de CLIENT, que va en tres idiomes, i el plural no és el mateix a
 * totes tres. Qui crida la construeix amb el seu diccionari; aquí només es
 * pinta.
 */
export function NavBadge({
  badgeKey,
  initial,
  label,
}: {
  badgeKey: BadgeKey;
  /** El número que ha calculat el servidor en renderitzar el layout. */
  initial: number;
  /** L'etiqueta per a qui escolta, amb el número de debò (no el "9+"). */
  label: (count: number) => string;
}) {
  const count = useBadgeCount(badgeKey, initial);

  if (count <= 0) return null;

  return (
    <span
      // Taronja de marca sobre el lila del menú: el mateix contrast que fa
      // servir la vora de l'entrada activa. Els tons `brand-*-dark` d'aquí no
      // es veurien.
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white"
      // L'etiqueta porta el número sencer encara que la bola digui "9+":
      // qui escolta no té cap motiu per quedar-se amb la versió escurçada.
      aria-label={label(count)}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
