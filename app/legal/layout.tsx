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
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark height={26} />
          </Link>
          <nav className="flex gap-4 text-xs font-bold tracking-wide text-brand-muted uppercase">
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
      <main className="mx-auto max-w-3xl px-6 py-8">
        <article className="prose-legal flex flex-col gap-4 text-sm leading-relaxed text-brand-charcoal">
          {children}
        </article>
      </main>
    </div>
  );
}
