import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { getCenterContact } from "@/lib/data/center-settings";
import { H, legalValues, Prevalence } from "@/components/legal/legal-text";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

/**
 * Avís legal, text definitiu (versió 2026-10). El titular, el NIF, l'adreça i
 * el correu surten de Configuració → Centre (0100, `legalValues`); el registre
 * sanitari i els fisioterapeutes col·legiats, també (0120). Sense aquestes
 * dades, la frase que en depèn no es pinta: mai un claudàtor.
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
  const contact = await getCenterContact();
  const v = legalValues(contact);
  const cfc = (chunks: ReactNode) => (
    <a href="https://www.fisioterapeutes.cat" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-purple underline">
      {chunks}
    </a>
  );
  const collegiates = contact.physioCollegiates;
  const registry = contact.healthRegistryNumber;

  return (
    <>
      <LegalDraftBanner doc="avisLegal" />
      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
      <p className="text-xs text-brand-muted">{g("version")}</p>

      <H>{t("h1")}</H>
      <p>{t.rich("p1", v)}</p>
      <p>{t("p1b")}</p>
      {/* Fisioteràpia (0120): només amb dades. Cada frase, només si hi ha el seu tros. */}
      {(collegiates.length > 0 || registry) && (
        <p data-legal-physio>
          <strong>{t("physioTitle")}</strong>{" "}
          {collegiates.length > 0 &&
            t.rich("physioCollegiates", {
              list: collegiates.map((c) => t("physioItem", { name: c.name, number: c.number })).join("; "),
              cfc,
            })}
          {collegiates.length > 0 && registry && " "}
          {registry && t("physioRegistry", { number: registry })}
        </p>
      )}

      <H>{t("h2")}</H>
      <p>{t("p2")}</p>

      <H>{t("h3")}</H>
      <p>{t("p3")}</p>

      <H>{t("h4")}</H>
      <p>{t("p4")}</p>

      <H>{t("h5")}</H>
      <p>{t("p5")}</p>

      <H>{t("h6")}</H>
      <p>{t("p6")}</p>

      <Prevalence text={g("prevalence")} />
    </>
  );
}
