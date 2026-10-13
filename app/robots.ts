import type { MetadataRoute } from "next";

/**
 * robots.txt
 *
 * VindiApp és l'eina del centre, no la seva web: la que s'ha de trobar a
 * Google és la web del centre, que enllaça a /prova i al login. Per això cap
 * pàgina d'aquí s'indexa (`robots: noindex` al layout arrel), tampoc /prova:
 * - la web del centre té el context (fotos, equip, preus) i és on ha d'arribar
 *   qui busca; /prova sola, des de Google, és un calendari sense explicació;
 * - el domini `vercel.app` és provisional: tot el que s'indexés ara s'hauria
 *   de redirigir el dia que hi hagi domini propi;
 * - com que l'idioma va per galeta, Google només en veuria el català.
 *
 * Les pàgines públiques NO es bloquegen aquí: el `noindex` només funciona si
 * el robot pot llegir la pàgina, i WhatsApp o Instagram la llegeixen per fer la
 * vista prèvia de l'enllaç. El que es bloqueja són les àrees amb sessió i les
 * API, que no tenen res a fer en un cercador.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/trainer", "/client", "/api/", "/auth/"],
    },
  };
}
