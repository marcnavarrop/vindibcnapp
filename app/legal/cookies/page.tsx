import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { H, RICH, Prevalence } from "@/components/legal/legal-text";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

/**
 * ⚠️ BORRADOR LEGAL — TEXT DE PARTIDA, NO DEFINITIU.
 * Pendent de revisió per un assessor legal. Cal confirmar l'inventari real de
 * cookies (només tècniques d'autenticació avui) abans de publicar.
 *
 * El text viu a `messages/*.json`, sota `legalPages.cookies`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalPages.cookies");
  return { title: t("metaTitle") };
}

export default async function CookiesPage() {
  const t = await getTranslations("legalPages.cookies");
  const g = await getTranslations("legalPages");

  return (
    <>
      <LegalDraftBanner doc="cookies" />
      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
      <p className="text-xs text-brand-muted">{g("draftVersion")}</p>

      <H>{t("h1")}</H>
      <p>{t("p1")}</p>

      <H>{t("h2")}</H>
      <p>{t.rich("p2", RICH)}</p>

      <H>{t("h3")}</H>
      <p>{t("p3")}</p>

      <H>{t("h4")}</H>
      <p>{t("p4")}</p>

      <Prevalence text={g("prevalence")} />
    </>
  );
}
