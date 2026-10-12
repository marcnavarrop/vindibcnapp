import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AUTH_LANDING_NAMESPACES, pickMessages } from "@/lib/i18n/client-namespaces";

/**
 * Les pantalles d'aterratge dels correus de compte: fixar la contrasenya
 * (invitació i recuperació) i confirmar el canvi de correu.
 *
 * PER QUÈ AQUEST LAYOUT NO HI ERA, I PER QUÈ ARA SÍ
 *
 * `app/(auth)` ja tenia el seu proveïdor —login i registre van traduïts des del
 * primer dia— però `app/auth` no en tenia cap, i les seves pàgines estaven
 * escrites en català a pèl. El resultat era una cadena trencada per la meitat:
 * el correu que hi porta SÍ que va en l'idioma de qui el rep, i la pantalla on
 * aterra, no. Un client amb el perfil en castellà demanava restablir la
 * contrasenya i acabava en una pàgina que no entén.
 *
 * Els formularis són components de client, així que el proveïdor ha de ser aquí
 * perquè els missatges arribin al navegador. Mateix criteri que `app/prova`.
 */
export default async function AuthLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Només els namespaces que fan servir els components de client d'aquesta
  // àrea (vegeu `lib/i18n/client-namespaces.ts`); la resta del diccionari ja
  // no viatja a cada pàgina.
  const messages = pickMessages(await getMessages(), AUTH_LANDING_NAMESPACES);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
