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
  // Aquí hi havia un verd (#15803d) i s'ha tret: al calendari del client el
  // verd ja vol dir "aquesta reserva és teva" i "aquest grup té plaça". Un
  // professional pintat de verd feia que el mateix color signifiqués dues
  // coses a la mateixa pantalla. Vegeu RESERVED_GREENS.
  "#7e22ce", // violeta
];

/**
 * Verds que ja tenen significat propi al calendari del client i que, per tant,
 * cap professional no pot fer servir:
 *   #16a34a → la reserva és TEVA
 *   #10b981 → aquest grup té plaça lliure
 *
 * Estan escrits aquí i no importats de group-occupancy per no lligar aquest
 * fitxer —que és pura paleta— amb la lògica del semàfor; si algun dia canvien
 * allà, el test de sota falla i es veu de seguida.
 */
export const RESERVED_GREENS = ["#16a34a", "#10b981"];

/**
 * Distància perceptual mínima (ΔE en Lab) que ha de guardar el color d'un
 * professional respecte dels verds reservats.
 *
 * 30 no és arbitrari: el verd que hi havia a la paleta estava a 17,6 del verd
 * de "reserva pròpia" —prou a prop perquè es llegissin com el mateix color— i
 * el verd-blau que es queda està a 38,2. El llindar passa entremig amb marge
 * per totes dues bandes.
 */
export const MIN_GREEN_DISTANCE = 30;

function toLab(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Distància perceptual entre dos colors. Més gran = més distingibles. */
export function colorDistance(a: string, b: string): number {
  const [la, aa, ba] = toLab(a);
  const [lb, ab, bb] = toLab(b);
  return Math.hypot(la - lb, aa - ab, ba - bb);
}

/**
 * És massa a prop d'un verd amb significat propi?
 *
 * Es comprova en desar el color d'un professional: la paleta per defecte ja no
 * en té cap, però l'admin pot escriure qualsevol hex a mà i el verd ha de
 * quedar reservat també contra això.
 */
export function isReservedGreen(hex: string): boolean {
  return RESERVED_GREENS.some(
    (g) => colorDistance(hex, g) < MIN_GREEN_DISTANCE,
  );
}

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
