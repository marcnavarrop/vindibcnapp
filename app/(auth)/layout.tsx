import { NextIntlClientProvider } from "next-intl";
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
  // El contacte del centre, per a qui encara no té compte (vegeu
  // `components/center-contact-line.tsx`).
  const contact = publicContact(await getCenterContact());
  return (
    <NextIntlClientProvider>
      <CenterContactProvider contact={contact}>{children}</CenterContactProvider>
    </NextIntlClientProvider>
  );
}
