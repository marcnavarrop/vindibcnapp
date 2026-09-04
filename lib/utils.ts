/**
 * Une clases CSS condicionales filtrando valores vacíos/falsy.
 * Versión mínima (sin dependencias) al estilo de `clsx`.
 */
export function clsx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Normalitza text per a cerques: minúscules i sense accents, de manera que
 * "ana" trobi "Ana", "ANA" i "Àna".
 */
export function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Deixa només els dígits (per comparar telèfons escrits amb espais o prefix). */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Prefix del país del centre. Aquí i no escampat: si un dia el centre no és a Espanya, es canvia en un lloc. */
const DEFAULT_COUNTRY_CODE = "34";

/**
 * El número tal com el vol `wa.me`: només dígits, amb prefix de país i sense
 * el `+`. Torna null quan no hi ha res marcable.
 *
 * COM ESTÀ DESAT DE VERITAT. El comentari de `clients-table.tsx` deia que el
 * telèfon es guardava com "+34 600 100 001"; això és la llavor del mode
 * simulació. A la base real són dígits pelats, sense `+`, sense espais i sense
 * guions, i NO hi ha cap validació de format enlloc: el camp és text lliure i
 * només es comprova que estigui informat. O sigui que això ha d'empassar-se
 * qualsevol cosa que algú hagi teclejat.
 *
 * LES REGLES, i per què són aquestes:
 *
 *   · Es netegen tots els símbols. Un `00` al davant és la forma antiga
 *     d'escriure el `+`, així que es treu i el que queda ja porta país.
 *   · NOU dígits exactes = número nacional. Se li posa el 34 al davant: a
 *     Espanya un número són nou xifres, i el centre és a Barcelona, així que
 *     no hi ha cap altra lectura possible.
 *   · Qualsevol altra llargada es passa TAL QUAL. És una decisió conscient:
 *     a la base hi ha números de deu xifres que no encaixen amb Espanya, i
 *     entre no oferir el botó o deixar que WhatsApp digui la seva, es tria el
 *     segon. Val més un enllaç que potser no obre conversa que cap botó.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;

  // El `+` es perd amb digitsOnly, però abans cal saber si hi era: amb `+` o
  // amb `00` al davant, el prefix de país ja hi és i no se n'hi posa cap altre.
  const jaInternacional = raw.startsWith("+") || digitsOnly(raw).startsWith("00");
  const digits = digitsOnly(raw).replace(/^00/, "");
  if (!digits) return null;

  if (!jaInternacional && digits.length === 9) return DEFAULT_COUNTRY_CODE + digits;
  return digits;
}

/**
 * Les classes que fan que un botó es NOTI en tocar-lo.
 *
 * Al mòbil no hi ha `hover:`, i entre el toc i la resposta de la pantalla no
 * passava res. `active:` sí que s'activa amb el dit.
 *
 * Viu aquí i no només dins de `<Button>` perquè el component base només
 * l'importen 7 fitxers: a l'app hi ha més de cent botons i enllaços escrits a
 * mà amb les seves pròpies classes, i havien de poder tenir el mateix tacte
 * sense reescriure'ls sencers. `<Button>` també la fa servir, així que no hi
 * ha dues versions d'això.
 *
 * NO porta el color: cada botó té el seu fons i s'enfosqueix amb el to que li
 * toca (`active:bg-brand-purple-dark`, `active:bg-brand-orange-dark`…). Aquí hi
 * ha el que és igual per a tots: l'encongiment, la durada i treure el destacat
 * blau que iOS i Android pinten pel seu compte.
 */
export const TAP =
  "transition-[background-color,border-color,opacity,transform] duration-100 " +
  "active:scale-95 disabled:active:scale-100 " +
  "[-webkit-tap-highlight-color:transparent] touch-manipulation";

/**
 * El mateix, per a superfícies grans: files de taula, cel·les de calendari,
 * targetes.
 *
 * És `TAP` sense l'encongiment. En un botó, un 5% menys es llegeix com un
 * clic; en una fila que ocupa tota l'amplada són quaranta píxels que s'escapen
 * cap endins, i les vores deixen de quadrar amb les del costat: no sembla
 * premuda, sembla trencada. El que sí funciona a qualsevol mida és que el fons
 * respongui, i això ho posa cada superfície amb el seu to.
 */
export const TAP_SURFACE =
  "transition-[background-color,border-color,opacity] duration-100 " +
  "[-webkit-tap-highlight-color:transparent] touch-manipulation";
