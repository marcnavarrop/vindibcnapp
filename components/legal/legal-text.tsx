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

/**
 * Els valors de les pàgines legals que surten de Configuració → Centre (0100):
 * titular, NIF, adreça i correu de contacte. Buit → «none», i el text tria la
 * frase sense aquell tros (vegeu `legalPages.*.p1` i `p8`). Mai un [CLAUDÀTOR].
 */
export function legalValues(c: {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
}) {
  const email = c.email ?? "none";
  return {
    ...RICH,
    name: c.legalName ?? "none",
    nif: c.taxId ?? "none",
    address: c.address ?? "none",
    email,
    mail: (chunks: ReactNode) => (
      <a href={`mailto:${email}`} className="font-bold text-brand-purple underline">
        {chunks}
      </a>
    ),
  };
}

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
