import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
