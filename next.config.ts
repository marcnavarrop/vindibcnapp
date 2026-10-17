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
 * La CSP BLOQUEJA des del 17/10/2026 (abans, del 13/10, en `Report-Only`).
 * Es va activar després d'una passada amb Playwright sense cap avís: les pàgines
 * públiques de producció i les pantalles amb sessió dels tres rols. El que
 * bloqueja s'apunta igualment als registres de Vercel ([csp], vegeu
 * app/api/csp-report).
 *
 * TORNAR ENRERE EN UN PAS: posar `CSP_ENFORCE = false` (aquí sota). La
 * capçalera passa a ser `Content-Security-Policy-Report-Only`: avisa i no
 * bloqueja res, amb la mateixa política.
 *
 * D'on ve cada origen extern:
 * - Supabase (`NEXT_PUBLIC_SUPABASE_URL`): l'API, l'accés i Storage (fotos,
 *   vídeos i documents amb URL signada).
 * - YouTube sense galetes: els vídeos d'exercicis enllaçats (exercise-library).
 * - vercel.live: la barra de comentaris de Vercel a les previsualitzacions.
 * - Stripe: només s'hi surt (`form-action`): Checkout per pagar i el portal
 *   (`billing.stripe.com`) per gestionar la subscripció. No hi ha cap script
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

/** Vegeu dalt: `false` torna la CSP a Report-Only (avisa, no bloqueja). */
const CSP_ENFORCE = true;

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE} https://vercel.live https://vercel.com`,
  `media-src 'self' blob: ${SUPABASE}`,
  "font-src 'self' data: https://vercel.live",
  `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} https://vercel.live wss://ws-us3.pusher.com`,
  "frame-src https://www.youtube-nocookie.com https://vercel.live",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
  // Ningú pot posar l'app dins d'un iframe (clickjacking al login). En
  // Report-Only el navegador l'ignora (i Safari avisa a cada pàgina): només hi
  // va quan la CSP bloqueja.
  ...(CSP_ENFORCE ? ["frame-ancestors 'none'"] : []),
  // On van els avisos (app/api/csp-report). Sense, Safari ni els genera.
  "report-uri /api/csp-report",
  "report-to csp",
]
  .join("; ")
  .replace(/\s+/g, " ");

const SECURITY_HEADERS = [
  { key: CSP_ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: CSP },
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  // El mateix que `frame-ancestors 'none'`, per als navegadors que no la
  // llegeixen i per si la CSP torna a Report-Only.
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

  /**
   * /admin/facturacio no té pàgina pròpia: entra per Tarifes.
   *
   * Abans ho feia una pàgina amb `redirect()`, i el router de Next petava amb
   * «Rendered more hooks than during the previous render» (React #310) cada
   * cop que s'hi entrava per l'adreça o des d'un enllaç vell; després es
   * refeia i pintava Tarifes. Aquí la redirecció passa abans que React hi
   * entri. El menú ja enllaça directament a Tarifes.
   */
  async redirects() {
    return [
      {
        source: "/admin/facturacio",
        destination: "/admin/facturacio/tarifes",
        permanent: false,
      },
    ];
  },

  experimental: {
    /**
     * Cos màxim d'una Server Action. El default de Next és 1 MB; aquí 4 MB
     * per marge. Cap fitxer gros hi viatja ja: els vídeos d'exercicis i els
     * documents del client es pugen directament a Storage des del navegador.
     *
     * 4 MB i no més: Vercel talla les peticions a funcions a ~4,5 MB i respon
     * 413 abans que Next hi digui res. Els vídeos d'exercicis ja NO passen per
     * aquí: el navegador els puja directament a Storage amb un permís signat
     * (lib/data/exercise-videos.ts), sense aquest límit.
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
