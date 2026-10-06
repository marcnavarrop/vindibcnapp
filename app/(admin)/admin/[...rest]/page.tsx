import { notFound } from "next/navigation";

/**
 * Qualsevol adreça de /admin que no és cap pantalla.
 *
 * Sense aquesta ruta, Next pintaria el `not-found` de l'arrel (fora del marc,
 * sense menú i en l'idioma de la galeta) en comptes del de l'àrea. Té la
 * prioritat més baixa: qualsevol pantalla de veritat hi passa per davant.
 */
export default function AdminCatchAll() {
  notFound();
}
