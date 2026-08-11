import Link from "next/link";
import type { Metadata } from "next";
import { LoginPanel } from "@/app/(auth)/login/login-panel";
import { BrandPanel } from "@/components/auth/brand-panel";
import { TrialCta } from "@/components/trial-cta";

export const metadata: Metadata = {
  title: "Entrar · VindiBCN",
  description:
    "Accedeix al teu espai personal de VindiBCN: reserves, bons i novetats del centre.",
};

/**
 * Pantalla d'entrada: és alhora la portada pública i el login.
 *
 * Abans eren dues pàgines (`/` amb un hero i botons, `/login` amb el
 * formulari) que deien el mateix i s'havien de mantenir juntes. Ara `/`
 * redirigeix aquí i aquesta és l'única pantalla d'entrada que hi ha.
 */
export default async function LoginPage() {
  return (
    /* `lg:h-dvh` + `lg:overflow-hidden`: en escriptori la pantalla cap sencera
       i no es fa scroll per arribar al botó d'entrar. El `max-h` evita que en
       pantalles molt altes (1440p) la targeta s'estiri i quedi buida pel mig.
       En mòbil es manté el flux natural: allà sí que s'ha de poder desplaçar. */
    <main className="flex min-h-dvh items-center justify-center bg-brand-bg p-0 sm:p-4 lg:h-dvh lg:overflow-hidden lg:p-6">
      <div className="grid w-full max-w-6xl overflow-hidden bg-white shadow-xl sm:rounded-3xl lg:h-full lg:max-h-[840px] lg:grid-cols-2">
        <BrandPanel />

        <div className="flex flex-col justify-center gap-6 overflow-y-auto p-8 sm:p-10">
          <LoginPanel trialCta={<TrialCta />} />

          <footer className="text-center text-xs text-brand-muted">
            <Link href="/legal/privacitat" className="hover:text-brand-purple">
              Privacitat
            </Link>{" "}
            ·{" "}
            <Link href="/legal/avis-legal" className="hover:text-brand-purple">
              Avís legal
            </Link>{" "}
            ·{" "}
            <Link href="/legal/cookies" className="hover:text-brand-purple">
              Cookies
            </Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
