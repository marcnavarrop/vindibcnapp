import { NextIntlClientProvider } from "next-intl";
import { CenterContactProvider } from "@/components/center-contact-line";
import { getCenterContact } from "@/lib/data/center-settings";
import { publicContact } from "@/lib/center-contact";

/** La sessió de prova la demana gent SENSE compte: va traduïda com el login. */
export default async function ProvaLayout({
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
