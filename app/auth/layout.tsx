import { NextIntlClientProvider } from "next-intl";

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
export default function AuthLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
