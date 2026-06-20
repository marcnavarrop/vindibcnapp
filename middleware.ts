import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import type { Database } from "@/types/database";

type Role = Database["public"]["Enums"]["user_role"];

// Cada prefijo de ruta exige un rol concreto.
const ROUTE_ROLES: Record<string, Role> = {
  "/admin": "admin",
  "/trainer": "trainer",
  "/client": "client",
};

function protectedPrefixOf(pathname: string): string | undefined {
  return Object.keys(ROUTE_ROLES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirect(request: NextRequest, pathname: string, from?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (from) url.searchParams.set("redirectedFrom", from);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPrefix = protectedPrefixOf(pathname);

  // ───────────────────────── Modo simulación ─────────────────────────
  // Sin Supabase: el rol vive en una cookie que pone el login simulado.
  if (USE_MOCK) {
    if (!protectedPrefix) return NextResponse.next();

    const role = request.cookies.get(MOCK_ROLE_COOKIE)?.value as
      | Role
      | undefined;

    if (!role) return redirect(request, "/login", pathname);
    if (role !== ROUTE_ROLES[protectedPrefix]) {
      return redirect(request, `/${role}`);
    }
    return NextResponse.next();
  }

  // ───────────────────────── Modo real (Supabase) ─────────────────────
  // 1. Refresca la sesión (imprescindible para que la auth funcione).
  const { supabaseResponse, supabase, user } = await updateSession(request);

  // 2. Ruta pública: dejamos pasar (con la sesión ya refrescada).
  if (!protectedPrefix) return supabaseResponse;

  // 3. Sin sesión → al login, recordando a dónde quería ir.
  if (!user) return redirect(request, "/login", pathname);

  // 4. Con sesión: comprobamos el rol contra la tabla profiles.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== ROUTE_ROLES[protectedPrefix]) {
    // Rol incorrecto → a su propia área (o al login si no hay rol).
    return profile?.role
      ? redirect(request, `/${profile.role}`)
      : redirect(request, "/login");
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
