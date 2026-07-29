import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { seedProfiles } from "@/lib/mock/seed";
import { VIEWER_HEADERS, decodeHeaderValue } from "@/lib/auth-headers";
import type { UserRole, Specialty } from "@/types/database";

const ROLES: UserRole[] = ["admin", "trainer", "client"];

/**
 * Rol que el middleware ja ha validat en aquesta petició, si n'hi ha.
 *
 * És de confiança perquè el middleware esborra aquestes capçaleres a l'entrada
 * de TOTA petició que gestiona i només les torna a posar després de comprovar
 * la sessió; i perquè el seu `matcher` cobreix totes les rutes que criden
 * aquesta funció. Si falta, es retorna null i es fa el camí complet.
 * El contracte sencer és a lib/auth-headers.ts.
 */
async function validatedRoleFromMiddleware(): Promise<UserRole | null> {
  const raw = (await headers()).get(VIEWER_HEADERS.role);
  // Es valida contra la llista tancada: mai s'assigna un rol arbitrari.
  return raw && (ROLES as string[]).includes(raw) ? (raw as UserRole) : null;
}

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  specialty: Specialty | null;
};

/**
 * Devuelve el usuario actual (o null) de forma agnóstica al backend.
 *
 * - Modo simulación: lee el rol de la cookie y lo mapea a un perfil semilla.
 * - Modo real: usa Supabase Auth + la tabla `profiles`.
 *
 * Las pantallas usan esto en vez de hablar con Supabase directamente, así el
 * cambio a producción no toca las vistas.
 *
 * Envuelta en `React.cache()`: dentro de un mismo render (p. ej. el layout
 * `AppShell` y la página la invocan a la vez) solo hace UNA llamada a Supabase
 * Auth; las siguientes reutilizan el resultado memoizado del request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const validatedRole = await validatedRoleFromMiddleware();

  if (USE_MOCK) {
    // El rol validat pel middleware té prioritat sobre la cookie; si no n'hi
    // ha (ruta fora del matcher), es llegeix la cookie com sempre.
    const role =
      validatedRole ??
      ((await cookies()).get(MOCK_ROLE_COOKIE)?.value as UserRole | undefined);
    if (!role) return null;
    const profile = seedProfiles.find((p) => p.role === role);
    if (!profile) return null;
    return {
      id: profile.id,
      email: profile.email ?? "",
      fullName: profile.full_name ?? "",
      role,
      specialty: profile.specialty ?? null,
    };
  }

  // Camí ràpid: el middleware ja ha fet auth.getUser() i ha llegit `profiles`
  // en aquesta mateixa petició. Repetir-ho eren dos viatges de xarxa de més.
  if (validatedRole) {
    const h = await headers();
    const id = h.get(VIEWER_HEADERS.id);
    if (id) {
      const specialty = h.get(VIEWER_HEADERS.specialty);
      return {
        id,
        email: decodeHeaderValue(h.get(VIEWER_HEADERS.email) ?? ""),
        fullName: decodeHeaderValue(h.get(VIEWER_HEADERS.name) ?? ""),
        role: validatedRole,
        specialty: (specialty as Specialty | null) ?? null,
      };
    }
    // Rol sense id: dada incompleta. Es cau al camí complet, no s'endevina.
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, specialty")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name ?? "",
    role: profile.role,
    specialty: profile.specialty ?? null,
  };
});
