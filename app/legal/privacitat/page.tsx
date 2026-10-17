import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { getCenterContact } from "@/lib/data/center-settings";
import { H, RICH, legalValues, Prevalence } from "@/components/legal/legal-text";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

/**
 * Política de privacitat, text definitiu (versió 2026-10). Els paràgrafs de
 * dades de salut (`p2b`, 0118) i de la supressió amb l'arxiu clínic (`p2c`,
 * 0119) són els validats; la resta, el text definitiu de l'octubre del 2026.
 *
 * El text viu a `messages/*.json`, sota `legalPages.privacitat`. Si canvia el
 * català, les altres dues traduccions s'han de tornar a revisar: són
 * traduccions d'aquest, no textos independents.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalPages.privacitat");
  return { title: t("metaTitle") };
}

export default async function PrivacitatPage() {
  const t = await getTranslations("legalPages.privacitat");
  const g = await getTranslations("legalPages");
  const v = {
    ...legalValues(await getCenterContact()),
    aepd: (chunks: ReactNode) => (
      <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-purple underline">
        {chunks}
      </a>
    ),
  };

  return (
    <>
      <LegalDraftBanner doc="privacitat" />
      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
      <p className="text-xs text-brand-muted">{g("version")}</p>

      <H>{t("h1")}</H>
      <p>{t.rich("p1", v)}</p>

      <H>{t("h2")}</H>
      <p>{t("p2")}</p>
      {/* Dades de salut (0118) i què passa amb l'historial en la supressió (0119). */}
      <p>{t.rich("p2b", v)}</p>
      <p>{t.rich("p2c", v)}</p>

      <H>{t("h3")}</H>
      <p>{t("p3")}</p>

      <H>{t("h4")}</H>
      <ul className="ml-5 list-disc">
        {(["basis1", "basis2", "basis3", "basis4", "basis5"] as const).map((k) => (
          <li key={k}>{t.rich(k, RICH)}</li>
        ))}
      </ul>

      <H>{t("h5")}</H>
      <p>{t("p5")}</p>
      <ul className="ml-5 list-disc">
        {(["item1", "item2", "item3", "item4"] as const).map((k) => (
          <li key={k}>{t.rich(k, RICH)}</li>
        ))}
      </ul>
      <p>{t("p5b")}</p>

      <H>{t("h6")}</H>
      <ul className="ml-5 list-disc">
        {(["retention1", "retention2", "retention3", "retention4"] as const).map((k) => (
          <li key={k}>{t.rich(k, RICH)}</li>
        ))}
      </ul>

      <H>{t("h7")}</H>
      <p>{t.rich("p7", v)}</p>
      <p>{t("p7b")}</p>

      <H>{t("h8")}</H>
      <p>{t.rich("p8", v)}</p>

      <Prevalence text={g("prevalence")} />
    </>
  );
}
