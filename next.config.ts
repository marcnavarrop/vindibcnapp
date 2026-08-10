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
};

export default nextConfig;
