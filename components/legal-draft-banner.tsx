import { getTranslations } from "next-intl/server";

/**
 * Mentre els textos legals siguin esborranys, qui els llegeix ho ha de saber.
 *
 * Abans aquest avís només sortia en desenvolupament (`NODE_ENV`), o sigui que
 * l'única persona que MAI el veia era justament qui es podia equivocar: el
 * client real, que llegia un text amb els camps entre claudàtors sense omplir
 * i sense cap senyal que fos provisional.
 *
 * Ara mana aquesta constant i no l'entorn. Quan l'assessor doni el vistiplau,
 * es posa a `false` i el bàner desapareix de tot arreu —una línia, i queda
 * escrit al git qui i quan va donar el text per bo—.
 *
 * Va per document i no global perquè els tres no s'aprovaran alhora: pot ser
 * que la política de cookies quedi tancada abans que la de privacitat.
 */
export const LEGAL_DRAFT = {
  avisLegal: true,
  privacitat: true,
  cookies: true,
} as const;

export type LegalDoc = keyof typeof LEGAL_DRAFT;

export async function LegalDraftBanner({ doc }: { doc: LegalDoc }) {
  if (!LEGAL_DRAFT[doc]) return null;
  const t = await getTranslations("legalPages.draftBanner");
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div
      role="note"
      className="mb-6 rounded-lg border-2 border-brand-orange bg-brand-orange/10 px-4 py-3 text-sm text-brand-dark"
    >
      <strong className="font-bold text-brand-orange">{t("title")}</strong>{" "}
      {t("body")}
      {/* El detall de què falta per fer és per a l'equip, no per a qui llegeix
          la política: en producció seria soroll i confondria. */}
      {isDev && (
        <span className="mt-1 block text-xs text-brand-muted">
          {t("devNote")}
        </span>
      )}
    </div>
  );
}
