import { CircleAlert } from "lucide-react";

/**
 * Avís per a admin/trainer: el client rep fisioteràpia (o se li volen afegir
 * notes mèdiques) però encara no ha consentit el tractament de dades de salut.
 *
 * Curt i amb el detall plegat: surt a sobre de totes les pestanyes de la fitxa,
 * i sencer feia 160 px d'alt al mòbil abans del primer contingut.
 */
export function HealthConsentWarning({ hidden = false }: { hidden?: boolean } = {}) {
  // No el pot llegir (no és el seu professional assignat): no se sap si n'hi
  // ha. To neutre i sense «pendent», que seria afirmar una cosa que no se sap.
  if (hidden)
    return (
      <details
        className="group rounded-xl border border-brand-border bg-neutral-bg px-3.5 py-2.5 text-sm text-neutral-ink"
        data-consent-hidden
      >
        <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
          <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b className="font-bold">Consentiment de salut: no el pots veure.</b>{" "}
            <span className="underline group-open:hidden">Més info</span>
          </span>
        </summary>
        <p className="mt-1.5 pl-6 text-brand-charcoal">
          Només el veuen el seu professional assignat i l&apos;administració. No
          vol dir que falti. Abans d&apos;anotar-hi dades de salut, confirma amb
          l&apos;administració que l&apos;ha acceptat.
        </p>
      </details>
    );

  return (
    <details className="group rounded-xl border border-attention bg-attention-bg px-3.5 py-2.5 text-sm text-attention">
      <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
        <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b className="font-bold">Consentiment de salut pendent.</b> No hi anotis
          dades de salut fins que l&apos;accepti.{" "}
          <span className="underline group-open:hidden">Més info</span>
        </span>
      </summary>
      <p className="mt-1.5 pl-6 text-brand-charcoal">
        Aquest client encara no ha consentit el tractament de dades de salut. No
        registris notes mèdiques ni dades de salut fins que l&apos;accepti des de
        la seva àrea (Configuració → Privacitat i consentiments).
      </p>
    </details>
  );
}
