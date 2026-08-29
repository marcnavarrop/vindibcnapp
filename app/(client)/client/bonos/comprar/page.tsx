import { permanentRedirect } from "next/navigation";

/**
 * La compra d'un bo viu ara a /client/bonos, que és on aterra qui prem "Bons"
 * al menú. Aquesta ruta es queda com a redirecció i no com a pàgina morta
 * perquè hi ha correus JA ENVIATS que hi apunten —"Renovar el meu bo" i
 * "Tornar a comprar el bo"— i no es poden editar: ja són a bústies alienes.
 * Sense això, aquells botons donarien un 404 al client just quan torna.
 *
 * `permanentRedirect` (308) i no temporal: el trasllat és definitiu, i així els
 * navegadors i els correus deixen de tornar a demanar l'adreça antiga.
 */
export default function ComprarBonoRedirect() {
  permanentRedirect("/client/bonos");
}
