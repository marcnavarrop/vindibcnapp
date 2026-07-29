import type { Metadata } from "next";
import { Lora, Roboto_Condensed } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${lora.variable} ${robotoCondensed.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
