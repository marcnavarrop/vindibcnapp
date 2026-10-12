import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AUTH_NAMESPACES, pickMessages } from "@/lib/i18n/client-namespaces";
import { CenterContactProvider } from "@/components/center-contact-line";
import { getCenterContact } from "@/lib/data/center-settings";
import { publicContact } from "@/lib/center-contact";

/**
 * Login, registre i recuperació de contrasenya: pàgines públiques i, per tant,
 * traduïdes. El proveïdor va aquí perquè els formularis són components de
 * client i necessiten els missatges al navegador.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Només els namespaces que fan servir els components de client d'aquesta
  // àrea (vegeu `lib/i18n/client-namespaces.ts`); la resta del diccionari ja
  // no viatja a cada pàgina.
  const messages = pickMessages(await getMessages(), AUTH_NAMESPACES);
  // El contacte del centre, per a qui encara no té compte (vegeu
  // `components/center-contact-line.tsx`).
  const contact = publicContact(await getCenterContact());
  return (
    <NextIntlClientProvider messages={messages}>
      <CenterContactProvider contact={contact}>{children}</CenterContactProvider>
    </NextIntlClientProvider>
  );
}
