"use client";

import { TAP } from "@/lib/utils";
import { OPEN_SUPPORT_EVENT } from "@/lib/support-events";

/**
 * El suport, dins de la pàgina en comptes de flotant.
 *
 * On hi ha aquest botó, `data-support-inline` fa que el CSS amagui el flotant
 * (globals.css): a la rejilla del professional tapava la columna de la dreta.
 * Obre el mateix panell, així que no es perd res.
 */
export function SupportInlineButton() {
  return (
    <button
      type="button"
      data-support-inline
      onClick={() => window.dispatchEvent(new Event(OPEN_SUPPORT_EVENT))}
      aria-label="Obrir el suport"
      className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-purple hover:bg-brand-bg md:h-10 ${TAP}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.6" />
        <line x1="14.6" y1="9.4" x2="18.4" y2="5.6" />
        <line x1="5.6" y1="18.4" x2="9.4" y2="14.6" />
        <line x1="14.6" y1="14.6" x2="18.4" y2="18.4" />
        <line x1="5.6" y1="5.6" x2="9.4" y2="9.4" />
      </svg>
      <span className="hidden md:inline">Suport</span>
    </button>
  );
}
