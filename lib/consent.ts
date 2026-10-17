/**
 * Versió vigent de la Política de Privacitat / consentiments. En pujar una
 * versió nova (revisada per l'assessor legal), incrementa aquesta constant:
 * els consentiments antics quedaran registrats amb la seva versió i es podrà
 * demanar de nou l'acceptació de la versió actual.
 */
export const CURRENT_CONSENT_VERSION = "2026-10";

/**
 * Versió vigent del CONSENTIMENT DE DADES DE SALUT (0118). Va a part de la de
 * privacitat: el text del consentiment de salut (tests i mesures + seguiment de
 * fisioteràpia) va canviar l'octubre del 2026, validat per l'assessor. La base
 * demana aquesta versió o posterior per crear tests (`client_tests_consent_ok`):
 * si es puja, s'ha de pujar també allà.
 */
export const CURRENT_HEALTH_CONSENT_VERSION = "2026-10";

/** Aquesta versió del consentiment de salut és la vigent (o posterior)? Format «AAAA-MM». */
export function isCurrentHealthConsent(version: string | null | undefined): boolean {
  return !!version && version >= CURRENT_HEALTH_CONSENT_VERSION;
}
