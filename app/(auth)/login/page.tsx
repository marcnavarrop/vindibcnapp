import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginPanel } from "@/app/(auth)/login/login-panel";
import { BrandPanel } from "@/components/auth/brand-panel";
import { TrialCta } from "@/components/trial-cta";

/**
 * El títol i la descripció també van traduïts: són el que es veu a la pestanya
 * del navegador i el que ensenya un enllaç compartit.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * Pantalla d'entrada: és alhora la portada pública i el login.
 *
 * Abans eren dues pàgines (`/` amb un hero i botons, `/login` amb el
 * formulari) que deien el mateix i s'havien de mantenir juntes. Ara `/`
 * redirigeix aquí i aquesta és l'única pantalla d'entrada que hi ha.
 */
export default async function LoginPage() {
  const [t, locale] = await Promise.all([
    getTranslations("legal"),
    resolveLocale(),
  ]);

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

          {/* La tria d'idioma va a l'entrada: qui encara no té compte no té
              cap altre lloc on canviar-la, i és la primera pantalla que veu. */}
          <div className="flex justify-center">
            <LanguageSwitcher current={locale} />
          </div>

          <footer className="text-center text-xs text-brand-muted">
            <Link href="/legal/privacitat" className="hover:text-brand-purple">
              {t("privacy")}
            </Link>{" "}
            ·{" "}
            <Link href="/legal/avis-legal" className="hover:text-brand-purple">
              {t("notice")}
            </Link>{" "}
            ·{" "}
            <Link href="/legal/cookies" className="hover:text-brand-purple">
              {t("cookies")}
            </Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
