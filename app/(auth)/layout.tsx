import { NextIntlClientProvider } from "next-intl";

/**
 * Login, registre i recuperació de contrasenya: pàgines públiques i, per tant,
 * traduïdes. El proveïdor va aquí perquè els formularis són components de
 * client i necessiten els missatges al navegador.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
