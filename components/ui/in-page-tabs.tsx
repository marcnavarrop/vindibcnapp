"use client";

import { useState } from "react";
import { clsx, TAP } from "@/lib/utils";

export type InPageTab = {
  label: string;
  content: React.ReactNode;
};

/**
 * Barra de pestanyes horitzontal amb commutació client-side (sense canvi de ruta).
 * Les pàgines pare (Server Components) construeixen l'array `tabs` amb el JSX de cada panell.
 */
export function InPageTabs({
  tabs,
  ariaLabel,
  initial = 0,
}: {
  tabs: InPageTab[];
  /** Nom de la barra per a lectors de pantalla; català per defecte
   *  perquè aquestes pestanyes també surten a admin i professional. */
  ariaLabel?: string;
  /**
   * Pestanya oberta d'entrada. Serveix quan qui arriba ve d'una redirecció que
   * porta un missatge per a una pestanya concreta: sense això el missatge es
   * pinta, però amagat darrere de la primera, i qui l'havia de llegir no el veu
   * mai. Fora de rang, torna a la primera.
   */
  initial?: number;
}) {
  const [active, setActive] = useState(
    initial >= 0 && initial < tabs.length ? initial : 0,
  );

  return (
    <div>
      <div className="mb-6 border-b border-brand-border">
        <nav className="flex overflow-x-auto" role="tablist" aria-label={ariaLabel ?? "Seccions"}>
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active === i}
              onClick={() => setActive(i)}
              className={clsx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap",
                TAP,
                active === i
                  ? "border-brand-purple text-brand-purple active:bg-brand-purple/10"
                  : "border-transparent text-brand-muted hover:text-brand-dark active:bg-brand-bg",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.label} className={active !== i ? "hidden" : undefined}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
