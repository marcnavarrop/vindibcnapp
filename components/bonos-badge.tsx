"use client";

import { useEffect, useState } from "react";
import { pendingBonoCountAction } from "@/lib/actions/bonos";
import { BONOS_SEEN, type BonosSeenDetail } from "@/lib/bono-events";

/**
 * La piloteta de «Bons» al menú del client: quants en té per pagar.
 *
 * Compta els estats COBRABLES —pendents de pagament i decaiguts per
 * impagament—, que són els mateixos que pot cobrar el taulell. Els bons nascuts
 * de la renovació automàtica hi entren sols: neixen 'pending_payment'.
 *
 * ES DEMANA EL NÚMERO ELLA MATEIXA, com la de comunitat i per la mateixa raó:
 * `AppShell` és el layout i no es torna a renderitzar en navegar.
 *
 * I S'APAGA SENSE RECARREGAR en entrar a «Els meus bons», escoltant
 * `vindi:bonos-seen`.
 *
 * L'APAGADA ÉS D'AQUESTA SESSIÓ, NO PERMANENT
 *
 * A diferència de la de comunitat, aquí no es desa cap marca a la base: el
 * número es torna a comptar al següent muntatge del menú. És deliberat. Un
 * anunci llegit ja no és nou; un bo sense pagar SEGUEIX sense pagar per molt
 * que l'hagis mirat, i una piloteta que s'apagués per sempre diria que no deus
 * res quan sí que deus. Silenciar-la mentre hi ets és cortesia; oblidar-ho
 * seria mentir.
 */
export function BonosBadge() {
  /** `null` mentre no se sap. Amb 0 no es pinta res. */
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    pendingBonoCountAction().then(setPending, () => setPending(null));
  }, []);

  useEffect(() => {
    const onSeen = (e: Event) => {
      const detail = (e as CustomEvent<BonosSeenDetail>).detail;
      if (typeof detail?.pending === "number" && detail.pending >= 0)
        setPending(detail.pending);
    };
    window.addEventListener(BONOS_SEEN, onSeen);
    return () => window.removeEventListener(BONOS_SEEN, onSeen);
  }, []);

  if (pending === null || pending <= 0) return null;

  return (
    <span
      // Taronja de marca sobre el lila del menú, com la de comunitat: és el
      // contrast que ja fa servir la vora de l'entrada activa.
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white"
      aria-label={`${pending} ${pending === 1 ? "bo per pagar" : "bons per pagar"}`}
    >
      {pending > 9 ? "9+" : pending}
    </span>
  );
}
