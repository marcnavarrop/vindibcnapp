import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { CLIENT_AREA_NAMESPACES, pickMessages } from "@/lib/i18n/client-namespaces";
import { AppShell } from "@/components/app-shell";

/**
 * El proveïdor de traduccions viu aquí i no al layout arrel a posta.
 *
 * A l'arrel hi entrarien també l'admin i el professional, que es queden en
 * català fix: els missatges dels tres idiomes viatjarien al navegador de cada
 * pantalla interna per a res. Amb el proveïdor per àrea, l'àrea interna no
 * carrega ni el proveïdor ni els missatges.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Només els namespaces que fan servir els components de client d'aquesta
  // àrea (vegeu `lib/i18n/client-namespaces.ts`); la resta del diccionari ja
  // no viatja a cada pàgina.
  const messages = pickMessages(await getMessages(), CLIENT_AREA_NAMESPACES);
  return (
    <NextIntlClientProvider messages={messages}>
      <AppShell role="client">{children}</AppShell>
    </NextIntlClientProvider>
  );
}
