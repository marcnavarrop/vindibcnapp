"use client";

import { useBadgeCount } from "@/lib/badge-store";
import { OPEN_SUPPORT_EVENT } from "@/lib/support-events";
import { clsx, TAP } from "@/lib/utils";

/**
 * El SUPORT, DINS DEL MARC: la barra de dalt al mòbil i el peu del menú a
 * l'ordinador.
 *
 * Abans era un botó rodó flotant a baix a la dreta. Tapava el que hi hagués a
 * sota —el «Marcar com pagat» de l'última fila de Bons, un missatge d'error al
 * peu d'un formulari, la columna de la dreta de la rejilla— i quedava per
 * sobre del vel dels diàlegs. Al marc no tapa res: és fora del contingut.
 *
 * Obre el mateix panell (`SupportFab`, que ara és només el panell) amb el mateix
 * esdeveniment que ja feia servir el botó de l'agenda. On la pàgina en porta un
 * de propi (`data-support-inline`), el CSS amaga aquest: no n'hi ha dos.
 *
 * La piloteta, només a l'admin: tiquets oberts de tot l'equip. Ve del
 * magatzem de piloteta (`supportOpen`), que alimenta el panell.
 */
export function SupportTrigger({
  variant,
  showOpenCount,
}: {
  /** `bar`: icona a la barra lila del mòbil. `sidebar`: fila al peu del menú. */
  variant: "bar" | "sidebar";
  showOpenCount: boolean;
}) {
  const count = useBadgeCount("supportOpen", 0);
  const badge = showOpenCount && count > 0 ? count : null;
  const label = badge
    ? `Obrir el suport (${badge} ${badge === 1 ? "tiquet obert" : "tiquets oberts"})`
    : "Obrir el suport";
  const open = () => window.dispatchEvent(new Event(OPEN_SUPPORT_EVENT));

  if (variant === "bar")
    return (
      <button
        type="button"
        data-support-fab
        onClick={open}
        aria-label={label}
        className={`relative flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 ${TAP}`}
      >
        <LifebuoyIcon />
        {badge !== null && <Dot n={badge} />}
      </button>
    );

  return (
    <button
      type="button"
      data-support-fab
      onClick={open}
      aria-label={label}
      className={clsx(
        // Al calaix del mòbil (sota `lg`) 44 px per al dit; al menú fix de
        // l'escriptori, 40, com les entrades del menú.
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white active:bg-white/20 lg:min-h-10",
        TAP,
      )}
    >
      <LifebuoyIcon />
      Obrir un tiquet
      {badge !== null && (
        <span className="ml-auto">
          <Dot n={badge} inline />
        </span>
      )}
    </button>
  );
}

function Dot({ n, inline = false }: { n: number; inline?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        // Sobre el lila del marc, com les pilotetes del menú (`NavBadge`).
        "flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-attention",
        !inline && "absolute -top-0.5 -right-0.5 border-2 border-brand-purple",
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function LifebuoyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <line x1="14.6" y1="9.4" x2="18.4" y2="5.6" />
      <line x1="5.6" y1="18.4" x2="9.4" y2="14.6" />
      <line x1="14.6" y1="14.6" x2="18.4" y2="18.4" />
      <line x1="5.6" y1="5.6" x2="9.4" y2="9.4" />
    </svg>
  );
}
