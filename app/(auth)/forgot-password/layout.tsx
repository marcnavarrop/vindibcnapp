import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** Només el títol de la pestanya: la pàgina és un component de client i no en pot exportar. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forgotPassword");
  return { title: t("metaTitle") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
