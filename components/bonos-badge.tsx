"use client";

import { useTranslations } from "next-intl";
import { NavBadge } from "@/components/ui/nav-badge";
import { useBadgeEvent } from "@/lib/badge-store";
import { BONOS_SEEN, type BonosSeenDetail } from "@/lib/bono-events";

/**
 * La piloteta de «Bons» al menú del client: quants en té per pagar.
 *
 * Compta els estats COBRABLES —pendents de pagament i decaiguts per
 * impagament—, que són els mateixos que pot cobrar el taulell. Els bons nascuts
 * de la renovació automàtica hi entren sols: neixen 'pending_payment'.
 *
 * EL NÚMERO DE SORTIDA VE DEL SERVIDOR, com la de comunitat i per la mateixa
 * raó: dins de l'HTML es pinta al primer frame, i la prop només és el valor de
 * sortida del magatzem compartit, no l'estat de la piloteta.
 *
 * I S'APAGA SENSE RECARREGAR en entrar a «Els meus bons», escoltant
 * `vindi:bonos-seen`.
 *
 * L'APAGADA ÉS D'AQUESTA SESSIÓ, NO PERMANENT
 *
 * A diferència de la de comunitat, aquí no es desa cap marca a la base: el
 * número es torna a comptar a la següent càrrega de la pàgina. És deliberat.
 * Un anunci llegit ja no és nou; un bo sense pagar SEGUEIX sense pagar per
 * molt que l'hagis mirat, i una piloteta que s'apagués per sempre diria que no
 * deus res quan sí que deus. Silenciar-la mentre hi ets és cortesia; oblidar-ho
 * seria mentir.
 *
 * I ARA SÍ QUE SE SILENCIA DEL TOT MENTRE HI ETS
 *
 * Abans no ho aconseguia en mòbil: del menú n'hi ha dues còpies muntades
 * —l'`<aside>` amagat i el calaix lliscant—, i la del calaix es tornava a
 * demanar el número en obrir-se, o sigui que ressuscitava una piloteta que
 * l'altra ja havia apagat. Amb el magatzem compartit les dues diuen el mateix,
 * que és el que aquest comentari ja prometia.
 */
export function BonosBadge({ initial }: { initial: number }) {
  const t = useTranslations("nav");

  useBadgeEvent<BonosSeenDetail>(BONOS_SEEN, "bonos", (detail) => detail?.pending);

  return (
    <NavBadge
      badgeKey="bonos"
      initial={initial}
      // Traduïda, com la resta del menú del client: fins ara deia "bons per
      // pagar" en català a qui tenia l'app en anglès o en castellà.
      label={(count) => t("badgeBonos", { count })}
    />
  );
}
