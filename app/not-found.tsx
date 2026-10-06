import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NotFoundPanel } from "@/components/not-found-panel";
import { Wordmark } from "@/components/wordmark";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("metaTitle") };
}

/**
 * «No existeix» fora de les àrees: una adreça pública mal escrita o un enllaç
 * vell. En l'idioma de qui mira (la galeta) i amb la marca a dalt. L'inici és
 * `/`, que porta a l'entrada; qui ja té sessió hi troba el camí a la seva àrea.
 */
export default async function RootNotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="min-h-screen bg-brand-bg">
      <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 pt-10 sm:p-6 sm:pt-16">
        <Link href="/" aria-label="VindiBCN">
          <Wordmark height={32} />
        </Link>
        <NotFoundPanel title={t("title")} body={t("body")} backHref="/" backLabel={t("back")} />
      </main>
    </div>
  );
}
