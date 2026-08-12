"use client";

import { useState } from "react";

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
          El teu codi de referit
        </p>
      )}
      <p className="mb-4 text-xs text-brand-muted">
        Comparteix-lo amb amics. Quan es registrin amb el teu codi i paguin el
        seu primer bo, tots dos rebreu un {discountPercent}% de descompte en la
        propera compra.
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
            {copied ? "Copiat!" : "Copiar"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-brand-muted">Codi no disponible.</p>
      )}

      <p className="mt-4 text-xs text-brand-muted">
        {referredCount === 0
          ? "Encara no has referit cap amic."
          : referredCount === 1
            ? "Has referit 1 amic."
            : `Has referit ${referredCount} amics.`}
      </p>
    </div>
  );
}
