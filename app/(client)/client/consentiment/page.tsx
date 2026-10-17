import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/auth";
import { getConsentStatus } from "@/lib/data/consents";
import { getCenterContact } from "@/lib/data/center-settings";
import { legalValues } from "@/components/legal/legal-text";
import { HealthConsentForm } from "@/components/forms/health-consent-form";
import { HealthConsentRevoke } from "@/components/forms/health-consent-revoke";
import { formatDate } from "@/lib/labels";
import { normalizeForSearch } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("healthConsent");
  return { title: t("metaTitle") };
}

/**
 * El consentiment de dades de salut (0118): el text sencer, validat per
 * l'assessor, en ca/es/en, i què n'has fet tu. Aquí es dona, es torna a donar
 * (si en tens una versió anterior) i es retira, tot al mateix lloc.
 *
 * Les dades del responsable (raó social, NIF, adreça, correu) surten de la
 * configuració del centre, com als textos legals: mai escrites a mà.
 */
export default async function HealthConsentPage() {
  const t = await getTranslations("healthConsent");
  const tc = await getTranslations("config");
  const locale = (await getLocale()) as Locale;
  // La pestanya de Privacitat a l'adreça, com la fa `InPageTabs` (depèn de l'idioma).
  const privacyTab = normalizeForSearch(tc("tabs.privacy")).trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const viewer = await getViewer();
  const [consent, contact] = await Promise.all([
    viewer ? getConsentStatus(viewer.id) : Promise.resolve(null),
    getCenterContact(),
  ]);
  const v = {
    ...legalValues(contact),
    aepd: (chunks: ReactNode) => (
      <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-purple underline">
        {chunks}
      </a>
    ),
    privacy: (chunks: ReactNode) => (
      <Link href="/legal/privacitat" target="_blank" className="font-bold text-brand-purple underline">
        {chunks}
      </Link>
    ),
  };

  const items: { label: string; body: ReactNode }[] = [
    { label: t("whatLabel"), body: t("what") },
    { label: t("whyLabel"), body: t("why") },
    { label: t("whoLabel"), body: t("who") },
    { label: t("howLongLabel"), body: t("howLong") },
    { label: t("voluntaryLabel"), body: t("voluntary") },
    { label: t("withdrawLabel"), body: t.rich("withdraw", v) },
    { label: t("rightsLabel"), body: t.rich("rights", v) },
  ];

  const current = consent?.healthDataCurrent ?? false;
  const old = !!consent?.healthDataAt && !current;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <Link href={`/client/configuracio?pestanya=${privacyTab}`} className="text-sm font-bold text-brand-purple hover:underline">
        ← {t("back")}
      </Link>
      <h1 className="text-2xl text-brand-dark">{t("title")}</h1>

      {/* Què n'has fet tu */}
      <p
        className={
          current
            ? "rounded-xl border border-success/30 bg-success-bg px-3.5 py-2.5 text-sm text-success"
            : old
              ? "rounded-xl border border-attention bg-attention-bg px-3.5 py-2.5 text-sm text-attention"
              : "rounded-xl border border-brand-border bg-neutral-bg px-3.5 py-2.5 text-sm text-neutral-ink"
        }
        data-health-consent={current ? "current" : old ? "old" : "none"}
      >
        {current
          ? t("statusCurrent", { date: formatDate(consent!.healthDataAt!, locale), version: consent!.healthDataVersion ?? "—" })
          : old
            ? t("statusOld", { date: formatDate(consent!.healthDataAt!, locale), version: consent!.healthDataVersion ?? "—" })
            : t("statusNone")}
      </p>

      <article className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-5 text-sm leading-relaxed text-brand-charcoal sm:p-6">
        <p>{t.rich("intro", v)}</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {items.map((i) => (
            <li key={i.label}>
              <b className="font-bold text-brand-dark">{i.label}</b> {i.body}
            </li>
          ))}
        </ul>
      </article>

      {viewer?.role === "client" && (
        <section className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
          {/* Sempre muntats (cadascun decideix què pinta): així, quan la pàgina es
              refresca després d'acceptar o retirar, la confirmació es queda. */}
          {/* Sense la versió vigent: la casella (la primera vegada o per tornar-lo a acceptar). */}
          <HealthConsentForm current={current} />
          {/* Vigent (de qualsevol versió): es pot retirar, aquí mateix. */}
          <HealthConsentRevoke active={!!consent?.healthDataAt} />
        </section>
      )}
    </main>
  );
}
