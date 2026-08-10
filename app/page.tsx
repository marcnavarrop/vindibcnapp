import { redirect } from "next/navigation";

/**
 * La portada és la pantalla d'entrada.
 *
 * Redirigeix en comptes de renderitzar el mateix component des de dues rutes:
 * així la pantalla té un sol propietari i no hi ha manera que `/` i `/login`
 * se separin amb el temps. A més, `/login` ja era la destinació a la qual el
 * middleware envia qui no té sessió, o sea que és la ruta canònica de fet.
 */
export default function Home() {
  redirect("/login");
}
