import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCenterSettings } from "@/lib/data/center-settings";

function GiftIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S10.5 3 7.5 3a2.5 2.5 0 000 5H12zM12 9s1.5-6 4.5-6a2.5 2.5 0 010 5H12z" />
    </svg>
  );
}

/**
 * Crida a l'acció cap a la sessió de prova gratuïta.
 *
 * No es renderitza si el mòdul de sessions de prova està desactivat. La ruta
 * `/prova` ja queda bloquejada per dins, però deixar l'enllaç a la vista era
 * pitjor que no tenir-lo: un visitant hi clicava i es trobava una porta
 * tancada, sense saber si s'havia equivocat ell.
 *
 * Viu en un component propi —encara que ara només surti a la pantalla
 * d'entrada— perquè la comprovació del mòdul no s'ha de tornar a escriure al
 * segon lloc on es posi l'enllaç.
 */
export async function TrialCta() {
  const [settings, t] = await Promise.all([
    getCenterSettings(),
    getTranslations("trial"),
  ]);
  if (!settings.modules.sessionsProva) return null;

  return (
    <Link
      href="/prova"
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-purple/8 px-4 py-3 text-sm font-bold text-brand-purple transition-colors hover:bg-brand-purple/15"
    >
      <GiftIcon />
      {t("cta")}
    </Link>
  );
}
