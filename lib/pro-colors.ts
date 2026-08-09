/**
 * Paleta per defecte dels professionals.
 *
 * Des de 0046 el color de cada professional es desa a `professional_colors` i
 * l'admin el pot canviar. Això d'aquí segueix sent la LLAVOR: el color que
 * s'assigna en donar d'alta algú nou, i el que es fa servir per a qui encara
 * no té fila (tots els professionals anteriors a la migració), de manera que
 * ningú no es queda sense color ni veu canviar el seu de cop.
 *
 * Viu en un fitxer propi i no dins d'un component perquè el calendari del
 * client, el de l'admin i qualsevol llegenda han de coincidir — si cadascú
 * tingués la seva còpia, deixarien de coincidir el dia que algú toqués una.
 */
export const PRO_PALETTE = [
  "#642263", // lila de marca
  "#ff6d17", // taronja d'accent
  "#1d8a8a", // verd-blau
  "#965495", // lila clar
  "#b45309", // ambre fosc
  "#2563eb", // blau
  "#be185d", // magenta
  "#15803d", // verd
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Color de qui no en té cap (reserves sense professional assignat). */
export const NEUTRAL_PRO_COLOR = "#8a8f98";

/** Color per defecte d'un professional, derivat de l'id. Gris si no n'hi ha. */
export function proColor(id: string | null): string {
  if (!id) return NEUTRAL_PRO_COLOR;
  return PRO_PALETTE[hashStr(id) % PRO_PALETTE.length];
}

/**
 * Següent color lliure de la paleta per a un professional nou.
 *
 * Tria el menys fet servir i, a igualtat, el primer de la paleta: mentre hi
 * hagi colors sense estrenar en surt sempre un de nou, i quan s'acaben es
 * reparteixen tan igual com es pugui en comptes de repetir sempre el mateix.
 */
export function nextAvailableProColor(used: string[]): string {
  const count = new Map<string, number>(PRO_PALETTE.map((c) => [c, 0]));
  for (const c of used) {
    const k = c.toLowerCase();
    if (count.has(k)) count.set(k, count.get(k)! + 1);
  }
  let best = PRO_PALETTE[0];
  for (const c of PRO_PALETTE)
    if (count.get(c)! < count.get(best)!) best = c;
  return best;
}
