import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RegisterPanel } from "@/app/(auth)/register/register-panel";
import { BrandPanel } from "@/components/auth/brand-panel";

/**
 * Alta de compte, amb la mateixa composició que l'entrada.
 *
 * L'embolcall és literalment el del login —el mateix `<main>`, la mateixa
 * targeta de dues columnes i el mateix `<BrandPanel />`— perquè eren la mateixa
 * pantalla amb dos aspectes diferents: qui venia d'/login i clicava "Crear
 * compte" queia en una targeta blanca soleta, sense marca ni il·lustració, i
 * semblava una altra aplicació.
 *
 * El panell de marca ja s'havia escrit pensant en això: el seu comentari deia
 * "si algun dia el registre estrena la mateixa composició, el panell ja és
 * aquí". No s'ha duplicat ni una línia de marcatge.
 *
 * NO hi ha `LanguageSwitcher` a nivell de columna, a diferència del login. El
 * registre ja en porta un DINS del formulari, amb la seva etiqueta i la seva
 * explicació, perquè allà l'idioma no és només com es veu la pantalla: és el
 * que es desa al perfil. Posar-ne un segon aquí en faria dos que diuen coses
 * diferents.
 */
export default async function RegisterPage() {
  const t = await getTranslations("legal");

  return (
    /* Mateixes mesures que /login: en escriptori la pantalla cap sencera i en
       mòbil es manté el flux natural. Aquí el formulari és força més llarg, i
       per això la columna dreta té el seu propi `overflow-y-auto`. */
    <main className="flex min-h-dvh items-center justify-center bg-brand-bg p-0 sm:p-4 lg:h-dvh lg:overflow-hidden lg:p-6">
      <div className="grid w-full max-w-6xl overflow-hidden bg-white shadow-xl sm:rounded-3xl lg:h-full lg:max-h-[840px] lg:grid-cols-2">
        <BrandPanel />

        {/* `justify-start` i no `justify-center` com al login: allà el contingut
            és curt i centrat queda bé, però aquest formulari és molt més llarg
            que la columna i, centrat, començava per la meitat —el titular i els
            primers camps quedaven amagats amunt i calia pujar amb la roda per
            trobar-los. Començant a dalt, es llegeix en l'ordre que toca. */}
        <div className="flex flex-col justify-start gap-6 overflow-y-auto p-8 sm:p-10">
          <RegisterPanel />

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
