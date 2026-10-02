"use client";

import { useEffect, useState } from "react";
import { clsx, TAP, normalizeForSearch } from "@/lib/utils";
import { SectionTabsFrame, sectionTabClass } from "@/components/ui/section-tabs";

export type InPageTab = {
  label: string;
  content: React.ReactNode;
};

/** La pestanya a l'adreça: «Notificacions» → `notificacions`. */
const slug = (label: string) => normalizeForSearch(label).trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Pestanyes dins d'una mateixa pantalla (Configuració), sense canviar de ruta.
 * Les pàgines pare (Server Components) construeixen l'array `tabs` amb el JSX
 * de cada panell.
 *
 * Tenen la forma del selector de secció (`SectionTabsFrame`) i RECORDEN on eres:
 * la pestanya va a l'adreça (`?pestanya=notificacions`), i en recarregar o tornar
 * enrere no et retornen a la primera.
 *
 * `legacy` deixa la forma d'abans (text i subratllat). La fa servir NOMÉS la fitxa
 * del client, que té deu pestanyes i es redissenyarà a part: amb el selector, al
 * mòbil serien quatre files de botons.
 */
export function InPageTabs({
  tabs,
  ariaLabel,
  initial = 0,
  legacy = false,
}: {
  tabs: InPageTab[];
  /** Nom de la barra per a lectors de pantalla; català per defecte
   *  perquè aquestes pestanyes també surten a admin i professional. */
  ariaLabel?: string;
  /**
   * Pestanya oberta d'entrada. Serveix quan qui arriba ve d'una redirecció que
   * porta un missatge per a una pestanya concreta: sense això el missatge es
   * pinta, però amagat darrere de la primera, i qui l'havia de llegir no el veu
   * mai. Fora de rang, torna a la primera. La de l'adreça, si n'hi ha, mana.
   */
  initial?: number;
  legacy?: boolean;
}) {
  const [active, setActive] = useState(
    initial >= 0 && initial < tabs.length ? initial : 0,
  );

  // La de l'adreça, després de muntar: el servidor no la sap, i fer-ho al
  // primer render faria que l'HTML del servidor i el del navegador no quadressin.
  useEffect(() => {
    if (legacy) return;
    const want = new URLSearchParams(window.location.search).get("pestanya");
    if (!want) return;
    const i = tabs.findIndex((t) => slug(t.label) === want);
    if (i >= 0) setActive(i);
    // Només en muntar: després mana el clic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (i: number) => {
    setActive(i);
    if (legacy) return;
    const url = new URL(window.location.href);
    url.searchParams.set("pestanya", slug(tabs[i].label));
    window.history.replaceState(window.history.state, "", url);
  };

  const panels = tabs.map((tab, i) => (
    <div key={tab.label} className={active !== i ? "hidden" : undefined}>
      {tab.content}
    </div>
  ));

  if (legacy)
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
                onClick={() => choose(i)}
                className={clsx(
                  "shrink-0 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap",
                  TAP,
                  active === i
                    ? "border-brand-purple text-brand-purple active:bg-brand-purple/10"
                    : "border-transparent text-brand-tab hover:text-brand-dark active:bg-brand-bg",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        {panels}
      </div>
    );

  return (
    <div>
      <SectionTabsFrame label={ariaLabel ?? "Seccions"}>
        <div role="tablist" aria-label={ariaLabel ?? "Seccions"} className="contents">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active === i}
              onClick={() => choose(i)}
              className={sectionTabClass(active === i)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </SectionTabsFrame>
      {panels}
    </div>
  );
}
