import { brandOgImage, OG_SIZE } from "@/lib/og-image";

export const alt = "Vindi BCN · Sessió de prova gratuïta";
export const size = OG_SIZE;
export const contentType = "image/png";

/** L'enllaç que més es compartirà: la web del centre i WhatsApp hi porten. */
export default function Image() {
  return brandOgImage({
    title: "Sessió de prova gratuïta",
    subtitle: "Entrenament personal · Gràcia, Barcelona",
  });
}
