import Link from "next/link";
import { getCenterSettings } from "@/lib/data/center-settings";

/**
 * Crida a l'acció cap a la sessió de prova gratuïta.
 *
 * No es renderitza si el mòdul de sessions de prova està desactivat. La ruta
 * `/prova` ja queda bloquejada per dins, però deixar l'enllaç a la vista era
 * pitjor que no tenir-lo: un visitant hi clicava i es trobava una porta
 * tancada, sense saber si s'havia equivocat ell.
 *
 * Viu en un component propi perquè el mateix enllaç surt a la home pública i
 * al login, i la comprovació no s'ha de duplicar (ni oblidar-se al tercer lloc
 * on es posi).
 */
export async function TrialCta({
  variant,
}: {
  /** `hero`: sobre el fons fosc de la home. `card`: sota la targeta del login. */
  variant: "hero" | "card";
}) {
  const settings = await getCenterSettings();
  if (!settings.modules.sessionsProva) return null;

  const className =
    variant === "hero"
      ? "inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-bold tracking-wide uppercase transition-colors hover:bg-white/20"
      : "mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-bold text-brand-purple hover:border-brand-purple";

  return (
    <Link href="/prova" className={className}>
      {variant === "hero"
        ? "🎁 Sessió de prova gratuïta"
        : "🎁 Vols provar-nos? Demana una sessió de prova gratuïta"}
    </Link>
  );
}
