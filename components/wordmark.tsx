/* eslint-disable @next/next/no-img-element */
import { clsx } from "@/lib/utils";

/**
 * Logotip oficial de Vindi.
 *
 * Abans això era el nom escrit en serif ("Vindi" + "BCN" en taronja) i, al
 * panell d'entrada, l'isotip i el text per separat. Ara tot passa per aquí:
 * un sol fitxer a tota l'app, perquè la marca no es pugui veure de dues
 * maneres segons la pantalla.
 *
 * L'alçada mana i l'amplada va sola (`w-auto`): així el logo no es pot
 * deformar per molt que canviï la caixa on es posi. Es manté el nom
 * `Wordmark` perquè és el que ja importaven vuit pantalles.
 *
 * S'usa <img> i no next/image: és un PNG local i petit amb mida coneguda.
 */
export function Wordmark({
  className,
  /** Alçada en píxels. El valor per defecte és el del sidebar. */
  height = 28,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <img
      src="/images/logo-vindi.png"
      alt="Vindi"
      width={Math.round((299 / 120) * height)}
      height={height}
      style={{ height }}
      // `self-start` perquè dins d'un flex en columna la imatge s'estirava a
      // tota l'amplada i el logo quedava centrat sense voler-ho.
      className={clsx("w-auto shrink-0 self-start object-contain", className)}
    />
  );
}
