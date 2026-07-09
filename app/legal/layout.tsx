import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark className="text-xl" />
          </Link>
          <nav className="flex gap-4 text-xs font-bold tracking-wide text-brand-muted uppercase">
            <Link href="/legal/privacitat" className="hover:text-brand-purple">
              Privacitat
            </Link>
            <Link href="/legal/avis-legal" className="hover:text-brand-purple">
              Avís legal
            </Link>
            <Link href="/legal/cookies" className="hover:text-brand-purple">
              Cookies
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <LegalDraftBanner />
        <article className="prose-legal flex flex-col gap-4 text-sm leading-relaxed text-brand-charcoal">
          {children}
        </article>
      </main>
    </div>
  );
}
