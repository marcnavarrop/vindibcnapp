import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/wordmark";

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("legalPages.nav");
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-border bg-white">
        {/* `flex-wrap`: a 320 px el logo i el menú no hi caben en una fila i
            abans s'enganxaven (0 px entre tots dos, «AVÍS LEGAL» partit en dues
            línies). Ara, si no hi caben, el menú baixa a sota del logo. */}
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <Link href="/">
            <Wordmark height={26} />
          </Link>
          <nav className="flex gap-4 text-xs font-bold tracking-wide whitespace-nowrap text-brand-muted uppercase">
            <Link href="/legal/privacitat" className="hover:text-brand-purple">
              {t("privacy")}
            </Link>
            <Link href="/legal/avis-legal" className="hover:text-brand-purple">
              {t("notice")}
            </Link>
            <Link href="/legal/cookies" className="hover:text-brand-purple">
              {t("cookies")}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <article className="prose-legal flex flex-col gap-4 text-sm leading-relaxed text-brand-charcoal">
          {children}
        </article>
      </main>
    </div>
  );
}
