/**
 * Avís per a admin/trainer: el client rep fisioteràpia (o se li volen afegir
 * notes mèdiques) però encara no ha consentit el tractament de dades de salut.
 */
export function HealthConsentWarning() {
  return (
    <div className="rounded-2xl border-2 border-brand-orange bg-brand-orange/10 px-5 py-4 text-sm">
      <p className="font-bold text-brand-orange">
        Consentiment de dades de salut pendent
      </p>
      <p className="mt-1 text-brand-charcoal">
        Aquest client encara no ha consentit el tractament de dades de salut. No
        registris notes mèdiques ni dades de salut fins que l&apos;accepti des de
        la seva àrea (Configuració → Privacitat i consentiments).
      </p>
    </div>
  );
}
