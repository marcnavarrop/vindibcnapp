import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { seedProfiles } from "@/lib/mock/seed";
import {
  VIEWER_HEADERS,
  decodeHeaderValue,
  verifyViewerClaims,
} from "@/lib/auth-headers";
import type { UserRole, Specialty } from "@/types/database";

const ROLES: UserRole[] = ["admin", "trainer", "client"];

type ValidatedIdentity = {
  id: string;
  role: UserRole;
  email: string;
  fullName: string;
  specialty: Specialty | null;
};

/**
 * La identitat que el middleware ja ha validat en aquesta petició, si n'hi ha.
 *
 * TRES COMPROVACIONS, I CAP D'ELLES SOBRA
 *
 *  1. El rol ha de ser un dels tres. Mai s'assigna un rol arbitrari.
 *  2. La FIRMA ha de quadrar. És el que fa que aquestes capçaleres no es puguin
 *     inventar des de fora encara que arribin a passar: sense la clau del
 *     servidor no se'n pot fabricar l'HMAC. Vegeu lib/auth-headers.ts.
 *  3. Si falta qualsevol de les dues coses, es retorna null i es fa el camí
 *     complet. Absència o sospita degraden a preguntar-li a Supabase, mai a
 *     endevinar.
 *
 * La firma es comprova sobre els valors TAL COM ARRIBEN (encara codificats):
 * és exactament el que va signar el middleware, i descodificar abans de
 * verificar obriria la porta a que dues cadenes diferents donessin la mateixa
 * firma.
 */
async function validatedIdentityFromMiddleware(): Promise<ValidatedIdentity | null> {
  const h = await headers();

  const raw = {
    id: h.get(VIEWER_HEADERS.id) ?? "",
    role: h.get(VIEWER_HEADERS.role) ?? "",
    email: h.get(VIEWER_HEADERS.email) ?? "",
    name: h.get(VIEWER_HEADERS.name) ?? "",
    specialty: h.get(VIEWER_HEADERS.specialty) ?? "",
  };

  if (!(ROLES as string[]).includes(raw.role)) return null;
  if (!(await verifyViewerClaims(raw, h.get(VIEWER_HEADERS.sig)))) return null;

  return {
    id: raw.id,
    role: raw.role as UserRole,
    email: decodeHeaderValue(raw.email),
    fullName: decodeHeaderValue(raw.name),
    specialty: (raw.specialty as Specialty) || null,
  };
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
  const validated = await validatedIdentityFromMiddleware();

  if (USE_MOCK) {
    // El rol validat pel middleware té prioritat sobre la cookie; si no n'hi
    // ha (ruta fora del matcher), es llegeix la cookie com sempre.
    const role =
      validated?.role ??
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
  if (validated?.id) {
    return {
      id: validated.id,
      email: validated.email,
      fullName: validated.fullName,
      role: validated.role,
      specialty: validated.specialty,
    };
  }
  // Rol sense id: dada incompleta. Es cau al camí complet, no s'endevina.

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
