"use client";

import { TAP } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReferralCodeCard } from "@/components/referral-code-card";

/**
 * Les dues targetes de "creixement" de l'inici del client: regalar i portar un
 * amic. Van juntes perquè demanen el mateix —compartir el centre amb algú— i
 * fins ara la de referits vivia sola al costat de la pròxima sessió, on no
 * tenia parella ni context.
 *
 * Són de client perquè la de referits obre el codi en un diàleg. Abans portava
 * a Configuració: tres pantalles per copiar vuit caràcters.
 */

const CARD =
  "relative overflow-hidden rounded-2xl p-5 text-white";
const ACTION =
  "mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-xs font-bold tracking-wide text-white uppercase transition-colors hover:bg-white/25 " +
  `active:bg-white/30 ${TAP}`;

function Glow({ className }: { className: string }) {
  return <div aria-hidden className={`pointer-events-none absolute ${className}`} />;
}

function GiftIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S10.5 3 7.5 3a2.5 2.5 0 000 5H12zM12 9s1.5-6 4.5-6a2.5 2.5 0 010 5H12z" />
    </svg>
  );
}

/** Regala Vindi. Taronja: és una compra, no una recomanació. */
export function GiftCta() {
  const t = useTranslations("growth.gift");
  return (
    <section className={CARD}>
      <Glow className="inset-0 bg-[linear-gradient(150deg,#c24d0d_0%,#ff6d17_60%,#ff8f4d_100%)]" />
      <Glow className="-top-12 -right-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,#ffffff_0%,transparent_65%)] opacity-30" />
      <div className="relative">
        <p className="text-base leading-tight font-bold text-balance">
          {t("title")}
        </p>
        <p className="mt-1.5 text-sm text-white/80">{t("body")}</p>
        <Link href="/client/regals" className={ACTION}>
          <GiftIcon />
          {t("action")}
        </Link>
      </div>
    </section>
  );
}

/** Porta un amic. El codi s'obre aquí mateix, en un diàleg. */
export function ReferralCta({
  code,
  referredCount,
  discountPercent,
}: {
  code: string | null;
  referredCount: number;
  discountPercent: number;
}) {
  const t = useTranslations("growth.referral");
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className={CARD}>
        <Glow className="inset-0 bg-[linear-gradient(150deg,#3d0f3c_0%,#642263_60%,#7d2b7b_100%)]" />
        <Glow className="-right-10 -bottom-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,var(--color-brand-orange)_0%,transparent_65%)] opacity-50" />
        <div className="relative">
          <p className="text-base leading-tight font-bold text-balance">
            {t("title")}
          </p>
          <p className="mt-1.5 text-sm text-white/70">{t("body")}</p>
          <button type="button" onClick={() => setOpen(true)} className={ACTION}>
            <GiftIcon />
            {t("action")}
          </button>
        </div>
      </section>

      <ConfirmDialog
        ariaClose={t("close")}
        open={open}
        onClose={() => setOpen(false)}
        title={t("dialogTitle")}
        actions={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            {t("close")}
          </button>
        }
      >
        {/* La mateixa targeta de Configuració → Dades personals: el codi, el
            botó de copiar i el compte d'amics referits surten d'un sol lloc. */}
        <ReferralCodeCard
          code={code}
          referredCount={referredCount}
          discountPercent={discountPercent}
          bare
        />
      </ConfirmDialog>
    </>
  );
}
