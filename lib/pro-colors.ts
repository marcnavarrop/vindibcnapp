/**
 * Color de cada professional, sempre el mateix.
 *
 * Es deriva de l'id amb un hash, així que no cal desar-lo enlloc ni mantenir
 * cap taula: el mateix professional surt del mateix color a tots els
 * calendaris. Viu aquí i no dins d'un component perquè el calendari del
 * client, el de l'admin i qualsevol llegenda han de coincidir — si cadascú
 * tingués la seva còpia, deixarien de coincidir el dia que algú toqués una.
 */
const PRO_PALETTE = [
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

/** Color assignat a un professional. Gris neutre si no n'hi ha. */
export function proColor(id: string | null): string {
  if (!id) return "#8a8f98";
  return PRO_PALETTE[hashStr(id) % PRO_PALETTE.length];
}
