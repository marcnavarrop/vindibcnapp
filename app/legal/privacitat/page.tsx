import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { H, RICH, Prevalence } from "@/components/legal/legal-text";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

/**
 * ⚠️ BORRADOR LEGAL — TEXT DE PARTIDA, NO DEFINITIU.
 * Generat automàticament com a punt de partida per a un centre d'entrenament
 * personal i fisioteràpia a Barcelona. PENDENT DE REVISIÓ per un assessor legal
 * abans de publicar. Cal omplir els camps entre [CLAUDÀTORS] i validar les
 * bases legals, terminis de conservació i encarregats del tractament.
 *
 * El text viu a `messages/*.json`, sota `legalPages.privacitat`. Si l'assessor
 * canvia el català, les altres dues traduccions s'han de tornar a revisar: són
 * traduccions d'aquest, no textos independents.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalPages.privacitat");
  return { title: t("metaTitle") };
}

export default async function PrivacitatPage() {
  const t = await getTranslations("legalPages.privacitat");
  const g = await getTranslations("legalPages");

  return (
    <>
      <LegalDraftBanner doc="privacitat" />
      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
      <p className="text-xs text-brand-muted">{g("draftVersion")}</p>

      <H>{t("h1")}</H>
      <p>{t("p1")}</p>

      <H>{t("h2")}</H>
      <p>{t("p2")}</p>

      <H>{t("h3")}</H>
      <p>{t("p3")}</p>

      <H>{t("h4")}</H>
      <p>{t.rich("p4", RICH)}</p>

      <H>{t("h5")}</H>
      <p>{t("p5")}</p>
      <ul className="ml-5 list-disc">
        <li>{t.rich("item1", RICH)}</li>
        <li>{t.rich("item2", RICH)}</li>
        <li>{t.rich("item3", RICH)}</li>
      </ul>
      <p>{t("p5b")}</p>

      <H>{t("h6")}</H>
      <p>{t("p6")}</p>

      <H>{t("h7")}</H>
      <p>{t.rich("p7", RICH)}</p>

      <H>{t("h8")}</H>
      <p>{t("p8")}</p>

      <Prevalence text={g("prevalence")} />
    </>
  );
}
