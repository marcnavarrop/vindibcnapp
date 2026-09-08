"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { TAP } from "@/lib/utils";

/**
 * Quan apareix. Prou avall com perquè no surti a la primera pantalla —hi ha
 * l'índex a la vista, tornar amunt no vol dir res encara— i prou amunt com per
 * tenir-lo ja al primer capítol.
 */
const SHOW_AFTER_PX = 600;

/**
 * "Torna a dalt" del manual.
 *
 * El manual és una sola pàgina llarga amb l'índex al capdamunt: qui arriba al
 * capítol dotze per un enllaç d'àncora no té cap manera de tornar al sumari
 * que no sigui arrossegar tot el document cap amunt.
 *
 * DISCRET A POSTA: blanc amb vora, petit i a l'altra punta de la pantalla. El
 * botó de marca d'aquesta pàgina és "Descarregar PDF", i dos botons liles
 * competint es llegeixen com dues accions igual d'importants quan no ho són.
 *
 * No surt al paper, com la resta de controls: seria una fletxa impresa que no
 * porta enlloc.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    // Es crida un cop d'entrada: si s'arriba amb l'àncora ja posada
    // (/client/ajuda#glossari) la pàgina neix desplaçada i mai no hi hauria
    // hagut cap esdeveniment de scroll.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      // Amagat de la navegació per teclat i del lector de pantalla mentre no
      // es veu: un botó transparent que rep el focus és un salt cap a un lloc
      // que no s'ensenya.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() =>
        window.scrollTo({
          top: 0,
          // Qui té l'animació desactivada al sistema no vol un document de
          // vint pantalles passant-li pels ulls.
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        })
      }
      className={`fixed right-4 bottom-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-white text-brand-muted shadow-md transition-opacity duration-200 hover:text-brand-purple focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 sm:right-6 sm:bottom-6 print:hidden ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      } ${TAP}`}
    >
      <span className="sr-only">Torna a dalt</span>
      <ArrowUp className="h-4 w-4" aria-hidden />
    </button>
  );
}
