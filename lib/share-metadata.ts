import type { Metadata } from "next";

/**
 * La imatge per compartir de l'arrel (`app/opengraph-image.tsx`).
 *
 * Una pàgina que defineix el seu propi `openGraph` NO hereta la imatge de
 * l'arrel (Next substitueix l'objecte sencer): sense això, l'enllaç del login
 * o del registre sortia sense imatge a WhatsApp. Tampoc la pròpia d'un
 * segment (`app/prova/opengraph-image.tsx`) guanya a la que es posa aquí: per
 * això /prova passa la seva com a `image`.
 */
const ROOT_IMAGE = "/opengraph-image";

/**
 * Títol i descripció d'una pàgina, també per a la vista prèvia en compartir-la.
 * Open Graph i Twitter no hereten el `title` de la pàgina: si no es repeteix
 * aquí, l'enllaç sortiria amb el títol genèric de l'arrel.
 */
export function shareMetadata(
  title: string,
  description?: string,
  image: string = ROOT_IMAGE,
): Metadata {
  const images = [{ url: image, width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    openGraph: { type: "website", siteName: "Vindi BCN", title, description, images },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
