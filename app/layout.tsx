import type { Metadata } from "next";
import { Lora, Roboto_Condensed } from "next/font/google";
import "./globals.css";
import { resolveLocale } from "@/lib/i18n/resolve";

// Titulares de marca.
// Pesos: solo los que se usan de verdad. Auditado sobre las clases aplicadas —
// `font-semibold` (600) y `font-light` (300) no aparecen en ningún componente.
// El único `font-medium` (500) ya cae a 400 hoy, porque 500 nunca se declaró.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Cuerpo / interfaz.
const robotoCondensed = Roboto_Condensed({
  variable: "--font-roboto-condensed",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "VindiBCN",
  description: "Gestió del centre d'entrenament personal i fisioteràpia",
};

/**
 * `lang` surt de la cookie d'idioma.
 *
 * Estava fixat a "es" i era senzillament fals: l'app parla català. Ara diu el
 * que la persona ha triat, que és el que fan servir els lectors de pantalla i
 * el traductor del navegador per no oferir-se a traduir el que ja s'entén.
 *
 * Aquí NOMÉS es llegeix la cookie: cap consulta a la base. El proveïdor de
 * traduccions no viu en aquest layout sinó als de client i autenticació, de
 * manera que l'admin i el professional no carreguen ni els missatges ni el
 * proveïdor.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveLocale();

  return (
    <html lang={locale}>
      <body
        className={`${lora.variable} ${robotoCondensed.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
