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
