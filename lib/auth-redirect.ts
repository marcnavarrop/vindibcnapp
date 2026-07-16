import type { UserRole } from "@/types/database";

/** Prefix d'àrea protegida per rol (ha de coincidir amb el middleware). */
const ROLE_PREFIX: Record<UserRole, string> = {
  admin: "/admin",
  trainer: "/trainer",
  client: "/client",
};
const PROTECTED_PREFIXES = Object.values(ROLE_PREFIX);

/** Home per defecte d'un rol (o l'arrel si no n'hi ha). */
export function roleHome(role: UserRole | undefined): string {
  return role ? `/${role}` : "/";
}

/**
 * Destí segur després del login. Retorna `raw` NOMÉS si:
 *  - és una ruta interna (comença per "/", mai "//" ni "/\", mai una URL
 *    absoluta) → evita open-redirect cap a dominis externs, i
 *  - si apunta a una àrea protegida, el rol de l'usuari hi té accés → evita
 *    saltar-se els permisos.
 * En qualsevol altre cas cau a la home del rol.
 */
export function safeRedirect(
  raw: string | null | undefined,
  role: UserRole | undefined,
): string {
  const home = roleHome(role);
  if (!raw) return home;
  // Només rutes internes absolutes (una sola barra inicial).
  if (!raw.startsWith("/")) return home;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return home;

  const path = raw.split("?")[0].split("#")[0];
  if (path === "/login") return home; // evita tornar al login (bucle)

  // Si el destí és una àrea protegida, ha de correspondre al rol.
  const protectedHit = PROTECTED_PREFIXES.find(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  if (protectedHit && protectedHit !== (role ? ROLE_PREFIX[role] : undefined))
    return home;

  return raw;
}
