/**
 * ⚠️ BORRADOR LEGAL — Aquest bàner avisa que els textos legals són esborranys
 * de partida generats automàticament i PENDENTS DE REVISIÓ per un assessor
 * legal abans de producció. Es mostra només en desenvolupament.
 */
export function LegalDraftBanner() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="mb-6 rounded-lg border-2 border-brand-orange bg-brand-orange/10 px-4 py-3 text-sm text-brand-dark">
      <strong className="font-bold text-brand-orange">
        ESBORRANY — pendent de revisió legal.
      </strong>{" "}
      Aquest text és una plantilla de partida i NO és el text legal definitiu.
      Cal que un assessor el revisi i ompli els camps entre claudàtors abans de
      publicar-lo.
    </div>
  );
}
