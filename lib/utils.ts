/**
 * Une clases CSS condicionales filtrando valores vacíos/falsy.
 * Versión mínima (sin dependencias) al estilo de `clsx`.
 */
export function clsx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
