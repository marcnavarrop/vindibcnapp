import { NextIntlClientProvider } from "next-intl";

/** La sessió de prova la demana gent SENSE compte: va traduïda com el login. */
export default function ProvaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
