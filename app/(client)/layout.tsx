import { NextIntlClientProvider } from "next-intl";
import { AppShell } from "@/components/app-shell";

/**
 * El proveïdor de traduccions viu aquí i no al layout arrel a posta.
 *
 * A l'arrel hi entrarien també l'admin i el professional, que es queden en
 * català fix: els missatges dels tres idiomes viatjarien al navegador de cada
 * pantalla interna per a res. Amb el proveïdor per àrea, l'àrea interna no
 * carrega ni el proveïdor ni els missatges.
 */
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider>
      <AppShell role="client">{children}</AppShell>
    </NextIntlClientProvider>
  );
}
