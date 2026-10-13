import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * next-intl en mode "sense enrutament d'idioma": l'idioma surt d'una cookie i
 * del perfil, no de l'URL. No hi ha cap segment [locale] i l'arbre de rutes es
 * queda igual, cosa que deixa el middleware —control d'accés dels tres rols i
 * `redirectedFrom`— exactament com estava.
 */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * Capçaleres de seguretat de totes les respostes.
 *
 * La CSP va en mode `Report-Only`: el navegador avisa a la consola del que
 * hauria bloquejat, però no bloqueja res. Quan s'hagi comprovat a producció
 * (pagament amb Stripe, vídeos, documents, fotos) que no surt cap avís, es pot
 * passar a `Content-Security-Policy` canviant només el nom de la capçalera.
 *
 * D'on ve cada origen extern:
 * - Supabase (`NEXT_PUBLIC_SUPABASE_URL`): l'API, l'accés i Storage (fotos,
 *   vídeos i documents amb URL signada).
 * - YouTube sense galetes: els vídeos d'exercicis enllaçats (exercise-library).
 * - vercel.live: la barra de comentaris de Vercel a les previsualitzacions.
 * - Stripe: només es surt cap a Checkout (`form-action`); no hi ha cap script
 *   de Stripe a l'app.
 * `'unsafe-inline'` als scripts és el que demana Next sense nonces (els seus
 * scripts en línia); `'unsafe-eval'` només en desenvolupament.
 */
const SUPABASE = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const SUPABASE_WS = SUPABASE.replace(/^https:/, "wss:");
const DEV = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE} https://vercel.live https://vercel.com`,
  `media-src 'self' blob: ${SUPABASE}`,
  "font-src 'self' data: https://vercel.live",
  `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} https://vercel.live wss://ws-us3.pusher.com`,
  "frame-src https://www.youtube-nocookie.com https://vercel.live",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
  // On van els avisos (app/api/csp-report). Sense, Safari ni els genera.
  "report-uri /api/csp-report",
  "report-to csp",
  // `frame-ancestors 'none'` s'hi afegirà quan la CSP sigui obligatòria: en
  // Report-Only el navegador l'ignora (i Safari ho diu a cada pàgina).
]
  .join("; ")
  .replace(/\s+/g, " ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: CSP },
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  // Ningú pot posar l'app dins d'un iframe d'una altra web (clickjacking al
  // login). Va a part de la CSP perquè, en Report-Only, `frame-ancestors` no
  // bloqueja.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Res del que l'app no fa servir. Els permisos del reproductor de YouTube
  // (pantalla completa, autoplay…) no s'hi toquen.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Sense `x-powered-by: Next.js`: no cal anunciar amb què està fet.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  experimental: {
    /**
     * Cos màxim d'una Server Action. El default de Next és 1 MB, i com que el
     * vídeo d'un exercici viatja dins de l'acció, qualsevol vídeo real petava
     * amb una pantalla de "Application error" abans d'arribar al codi.
     *
     * 4 MB i no més: Vercel talla les peticions a funcions serverless a ~4,5
     * MB i respon 413 abans que Next hi digui res, així que pujar-ho més seria
     * prometre un límit que la plataforma no deixa complir. Per a vídeos
     * grossos caldria pujar-los directament a Storage des del navegador.
     */
    serverActions: { bodySizeLimit: "4mb" },
  },

  /**
   * El logotip ha de viatjar DINS de la funció que genera el PDF del val.
   *
   * A Vercel, `public/` el serveix la CDN i no forma part del sistema de
   * fitxers de la funció serverless: el `fs.readFile` del logo funcionava en
   * local i fallava en silenci a producció, i el val sortia amb "Vindi" escrit
   * en Helvetica en comptes de la marca. Amb això, el fitxer s'inclou al
   * paquet de la funció i el troba a tots dos llocs.
   *
   * Va per a totes les rutes i no només per a les del val: són 9 kB, i el dia
   * que un altre document el necessiti no ha de tornar a fallar igual.
   */
  outputFileTracingIncludes: {
    "/**": ["./public/images/logo-vindi.png"],
  },
};

export default withNextIntl(nextConfig);
