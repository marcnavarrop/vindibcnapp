import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import type { Database } from "@/types/database";

type Role = Database["public"]["Enums"]["user_role"];

// Cada prefijo de ruta exige un rol concreto.
const ROUTE_ROLES: Record<string, Role> = {
  "/admin": "admin",
  "/trainer": "trainer",
  "/client": "client",
};

export async function middleware(request: NextRequest) {
  // 1. Refresca la sesión (imprescindible para que la auth funcione).
  const { supabaseResponse, supabase, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // 2. ¿La ruta actual está protegida por rol?
  const protectedPrefix = Object.keys(ROUTE_ROLES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!protectedPrefix) {
    // Ruta pública: dejamos pasar (con la sesión ya refrescada).
    return supabaseResponse;
  }

  // 3. Sin sesión → al login, recordando a dónde quería ir.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // 4. Con sesión: comprobamos el rol contra la tabla profiles.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const requiredRole = ROUTE_ROLES[protectedPrefix];

  if (!profile || profile.role !== requiredRole) {
    // Rol incorrecto → lo mandamos a su propia área (o al login si no hay rol).
    const url = request.nextUrl.clone();
    url.pathname = profile?.role ? `/${profile.role}` : "/login";
    return NextResponse.redirect(url);
  }

  // 5. Todo correcto.
  return supabaseResponse;
}

export const config = {
  // Ejecuta el middleware en todo salvo assets estáticos e imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
