import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { H, Prevalence } from "@/components/legal/legal-text";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

/**
 * Política de cookies, text definitiu (versió 2026-10). La taula és
 * l'inventari real del codi (octubre 2026): la sessió de Supabase
 * (`@supabase/ssr`, 400 dies i renovada a cada visita; es parteix en `.0`,
 * `.1`… si és gran), l'idioma (`vindi_locale`, 1 any, `lib/i18n/config.ts`) i
 * el mode PRE (`vindi_pre` 8 h i `vindi_pre_back` 2 h, `lib/pre-mode.ts`).
 * `vindi_mock_role` només existeix en simulació. Si s'afegeix una cookie, s'ha
 * d'afegir aquí.
 *
 * El text viu a `messages/*.json`, sota `legalPages.cookies`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalPages.cookies");
  return { title: t("metaTitle") };
}

const ROWS = ["row1", "row2", "row3"] as const;

export default async function CookiesPage() {
  const t = await getTranslations("legalPages.cookies");
  const g = await getTranslations("legalPages");

  return (
    <>
      <LegalDraftBanner doc="cookies" />
      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>
      <p className="text-xs text-brand-muted">{g("version")}</p>

      <H>{t("h1")}</H>
      <p>{t("p1")}</p>

      <H>{t("h2")}</H>
      <p>{t("p2")}</p>

      {/* Al mòbil, una targeta per cookie: una taula de tres columnes a 375 px
          partia els noms lletra a lletra. A partir de `sm`, la taula. */}
      <ul className="flex flex-col gap-2 sm:hidden" data-cookie-cards>
        {ROWS.map((r) => (
          <li key={r} className="rounded-lg border border-brand-border bg-white p-3">
            <p className="font-mono text-xs break-words text-brand-dark">{t(`${r}Name`)}</p>
            <dl className="mt-2 grid grid-cols-1 gap-1 text-sm">
              <div>
                <dt className="inline font-bold text-brand-dark">{t("colPurpose")}: </dt>
                <dd className="inline">{t(`${r}Purpose`)}</dd>
              </div>
              <div>
                <dt className="inline font-bold text-brand-dark">{t("colDuration")}: </dt>
                <dd className="inline">{t(`${r}Duration`)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden w-full border-collapse text-left text-sm sm:table" data-cookie-table>
        <thead>
          <tr className="border-b border-brand-border">
            <th scope="col" className="py-2 pr-3 font-bold text-brand-dark">{t("colName")}</th>
            <th scope="col" className="py-2 pr-3 font-bold text-brand-dark">{t("colPurpose")}</th>
            <th scope="col" className="py-2 font-bold text-brand-dark">{t("colDuration")}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r} className="border-b border-brand-border align-top">
              <td className="py-2 pr-3 font-mono text-xs break-words text-brand-dark">{t(`${r}Name`)}</td>
              <td className="py-2 pr-3">{t(`${r}Purpose`)}</td>
              <td className="py-2">{t(`${r}Duration`)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>{t("p2b")}</p>
      <p>{t("p2c")}</p>

      <H>{t("h3")}</H>
      <p>{t("p3")}</p>

      <H>{t("h4")}</H>
      <p>{t("p4")}</p>

      <Prevalence text={g("prevalence")} />
    </>
  );
}
