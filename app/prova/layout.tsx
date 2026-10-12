import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { TRIAL_NAMESPACES, pickMessages } from "@/lib/i18n/client-namespaces";
import { CenterContactProvider } from "@/components/center-contact-line";
import { getCenterContact } from "@/lib/data/center-settings";
import { publicContact } from "@/lib/center-contact";

/** La sessió de prova la demana gent SENSE compte: va traduïda com el login. */
export default async function ProvaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Només els namespaces que fan servir els components de client d'aquesta
  // àrea (vegeu `lib/i18n/client-namespaces.ts`); la resta del diccionari ja
  // no viatja a cada pàgina.
  const messages = pickMessages(await getMessages(), TRIAL_NAMESPACES);
  // El contacte del centre, per a qui encara no té compte (vegeu
  // `components/center-contact-line.tsx`).
  const contact = publicContact(await getCenterContact());
  return (
    <NextIntlClientProvider messages={messages}>
      <CenterContactProvider contact={contact}>{children}</CenterContactProvider>
    </NextIntlClientProvider>
  );
}
