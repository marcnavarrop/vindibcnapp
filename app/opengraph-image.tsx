import { brandOgImage, OG_SIZE } from "@/lib/og-image";

export const alt = "Vindi BCN · Àrea client";
export const size = OG_SIZE;
export const contentType = "image/png";

/** La de tota l'app (sobretot el login): el que es veu en compartir-ne l'enllaç. */
export default function Image() {
  return brandOgImage({
    title: "Àrea client",
    subtitle: "Entrenament personal i fisioteràpia · Gràcia, Barcelona",
  });
}
