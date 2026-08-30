"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function ReferralCodeCard({
  code,
  referredCount,
  discountPercent,
  bare = false,
}: {
  code: string | null;
  referredCount: number;
  discountPercent: number;
  /**
   * Sense caixa ni títol propis: quan ja va dins d'un diàleg que en posa un,
   * repetir-los feia "El teu codi de referit" dues vegades seguides.
   */
  bare?: boolean;
}) {
  const t = useTranslations("growth.referral.card");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={bare ? "" : "rounded-2xl border border-brand-border bg-white p-6"}>
      {!bare && (
        <p className="mb-1 text-sm font-bold text-brand-dark">
          {t("title")}
        </p>
      )}
      <p className="mb-4 text-xs text-brand-muted">
        {t("hint", { percent: discountPercent })}
      </p>

      {code ? (
        <div className="flex items-center gap-3">
          <span className="rounded-lg border-2 border-dashed border-brand-purple/40 bg-brand-purple/5 px-4 py-2 font-mono text-lg font-bold tracking-widest text-brand-purple">
            {code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-brand-border bg-white px-3 py-2 text-xs font-bold text-brand-dark transition-colors hover:border-brand-purple hover:text-brand-purple"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      ) : (
        <p className="text-sm text-brand-muted">{t("unavailable")}</p>
      )}

      <p className="mt-4 text-xs text-brand-muted">
        {/* Plural ICU: el "1 amics" del `if` de tota la vida no passa a
            l'anglès, i cada idioma compta a la seva manera. */}
        {t("referredCount", { count: referredCount })}
      </p>
    </div>
  );
}
