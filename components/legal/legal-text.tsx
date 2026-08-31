import type { ReactNode } from "react";

/**
 * Peces compartides de les pàgines legals.
 *
 * Van en un component a part perquè el text jurídic porta negretes dins de
 * frases —"el teu <b>consentiment</b> exprés"— i, en un document amb valor
 * legal, una negreta no és decoració: marca què s'ha destacat. Amb `t.rich` i
 * aquesta etiqueta, el diccionari les conserva en els tres idiomes sense que
 * cada pàgina s'hagi d'inventar el seu marcatge.
 */
export const RICH = {
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
};

export function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 text-lg font-bold text-brand-dark">{children}</h2>;
}

/**
 * L'avís de prevalença.
 *
 * Va a totes tres pàgines i en tots tres idiomes, també en català: qui llegeix
 * la versió catalana ha de saber igualment que n'hi ha d'altres i quina mana.
 * Es dibuixa com una nota visible, no com un peu que ningú mira.
 */
export function Prevalence({ text }: { text: string }) {
  return (
    <p className="mt-6 rounded-lg border border-brand-border bg-white px-4 py-3 text-xs text-brand-muted">
      {text}
    </p>
  );
}
