import "server-only";
import { cookies } from "next/headers";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { seedProfiles } from "@/lib/mock/seed";
import type { UserRole } from "@/types/database";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

/**
 * Devuelve el usuario actual (o null) de forma agnóstica al backend.
 *
 * - Modo simulación: lee el rol de la cookie y lo mapea a un perfil semilla.
 * - Modo real: usa Supabase Auth + la tabla `profiles`.
 *
 * Las pantallas usan esto en vez de hablar con Supabase directamente, así el
 * cambio a producción no toca las vistas.
 */
export async function getViewer(): Promise<Viewer | null> {
  if (USE_MOCK) {
    const role = (await cookies()).get(MOCK_ROLE_COOKIE)?.value as
      | UserRole
      | undefined;
    if (!role) return null;
    const profile = seedProfiles.find((p) => p.role === role);
    if (!profile) return null;
    return {
      id: profile.id,
      email: profile.email ?? "",
      fullName: profile.full_name ?? "",
      role,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name ?? "",
    role: profile.role,
  };
}
