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
      // Sempre va sobre el lila del menú: píndola blanca amb el número en el
      // blau d'atenció (11,5:1). Abans era taronja, que des del pas 7 és
      // només dels grups (i el blanc a sobre feia 2,8:1).
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-attention"
      // L'etiqueta porta el número sencer encara que la bola digui "9+":
      // qui escolta no té cap motiu per quedar-se amb la versió escurçada.
      aria-label={label(count)}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
