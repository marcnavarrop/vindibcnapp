/**
 * Modo simulación.
 *
 * `USE_MOCK` es `true` mientras no haya un Supabase real configurado: o bien
 * porque la URL no está, o porque sigue siendo el placeholder de previsualización.
 * En cuanto pongas la `NEXT_PUBLIC_SUPABASE_URL` real en `.env.local`, se apaga
 * solo y la app pasa a usar Supabase de verdad. No hay que tocar código.
 *
 * También puedes forzarlo con `NEXT_PUBLIC_USE_MOCK=true`.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
  url === "" ||
  url.includes("placeholder");

/** Nombre de la cookie que guarda el rol en modo simulación. */
export const MOCK_ROLE_COOKIE = "vindi_mock_role";
