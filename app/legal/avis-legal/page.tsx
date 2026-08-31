import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { H, RICH, Prevalence } from "@/components/legal/legal-text";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

/**
 * ⚠️ BORRADOR LEGAL — TEXT DE PARTIDA, NO DEFINITIU.
 * Pendent de revisió per un assessor legal. Ompliu els [CLAUDÀTORS].
 *
 * El text viu a `messages/*.json`, sota `legalPages.avisLegal`. El català és
 * l'original i les altres dues llengües en són traduccions: així ho diu la
 * clàusula de prevalença que porta cada pàgina.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalPages.avisLegal");
  return { title: t("metaTitle") };
}

export default async function AvisLegalPage() {
  const t = await getTranslations("legalPages.avisLegal");
  const g = await getTranslations("legalPages");

  return (
    <>
      <LegalDraftBanner doc="avisLegal" />
      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
      <p className="text-xs text-brand-muted">{g("draftVersion")}</p>

      <H>{t("h1")}</H>
      <p>{t("p1")}</p>

      <H>{t("h2")}</H>
      <p>{t("p2")}</p>

      <H>{t("h3")}</H>
      <p>{t("p3")}</p>

      <H>{t("h4")}</H>
      <p>{t("p4")}</p>

      <H>{t("h5")}</H>
      <p>{t("p5")}</p>

      <H>{t("h6")}</H>
      <p>{t.rich("p6", RICH)}</p>

      <Prevalence text={g("prevalence")} />
    </>
  );
}
