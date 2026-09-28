/**
 * Com es compara el que s'escriu al buscador de clients amb un nom: sense
 * accents, sense majúscules i paraula per paraula, en qualsevol ordre.
 *
 * Viu a part (sense res de Supabase) perquè ho fan servir la simulació, la
 * consulta real (`wordRegex`, amb `imatch`) i `npm run search:check`.
 */
/** Per comparar noms sense accents ni majúscules. */
export function foldName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Amb les majúscules accentuades escrites: que `imatch` les iguali depèn del
// «locale» de la base, i així no cal comptar-hi (les ASCII sí que les iguala).
const FOLD_CLASS: Record<string, string> = {
  a: "[aàáâäãÀÁÂÄÃ]",
  e: "[eèéêëÈÉÊË]",
  i: "[iìíîïÌÍÎÏ]",
  o: "[oòóôöõÒÓÔÖÕ]",
  u: "[uùúûüÙÚÛÜ]",
  c: "[cçÇ]",
  n: "[nñÑ]",
};

/** Les paraules de la cerca, sense accents ni majúscules. */
export function nameWords(q: string): string[] {
  return foldName(q).split(/\s+/).filter(Boolean);
}

/** L'expressió d'una paraula: cada lletra amb les seves grafies, la resta escapada. */
export function wordRegex(w: string): string {
  return [...w].map((ch) => FOLD_CLASS[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
}

export function matchesName(name: string, q: string): boolean {
  const n = foldName(name);
  return nameWords(q).every((w) => n.includes(w));
}

