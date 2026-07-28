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
