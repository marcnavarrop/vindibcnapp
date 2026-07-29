import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import {
  VIEWER_HEADERS,
  stripViewerHeaders,
  encodeHeaderValue,
} from "@/lib/auth-headers";
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
    // Se limpian SIEMPRE, incluso en rutas no protegidas: nadie puede colar
    // una identidad desde fuera. Ver lib/auth-headers.ts.
    const headers = new Headers(request.headers);
    stripViewerHeaders(headers);

    if (!protectedPrefix) return NextResponse.next({ request: { headers } });

    const role = request.cookies.get(MOCK_ROLE_COOKIE)?.value as
      | Role
      | undefined;

    if (!role) return redirect(request, "/login", pathname);
    if (role !== ROUTE_ROLES[protectedPrefix]) {
      return redirect(request, `/${role}`);
    }

    // Rol ya validado contra la cookie: se pasa al render.
    headers.set(VIEWER_HEADERS.role, role);
    return NextResponse.next({ request: { headers } });
  }

  // ───────────────────────── Modo real (Supabase) ─────────────────────
  // 1. Refresca la sesión (imprescindible para que la auth funcione).
  //    `requestHeaders` ya viene limpio de cabeceras de identidad.
  const { supabaseResponse, supabase, user, requestHeaders } =
    await updateSession(request);

  // 2. Ruta pública: dejamos pasar (con la sesión ya refrescada). No se pasa
  //    identidad: sin prefijo protegido no se ha comprobado el rol, así que
  //    `getViewer()` hará su consulta completa, como antes.
  if (!protectedPrefix) return supabaseResponse;

  // 3. Sin sesión → al login, recordando a dónde quería ir.
  if (!user) return redirect(request, "/login", pathname);

  // 4. Con sesión: comprobamos el rol contra la tabla profiles.
  //    Se piden también `full_name` y `specialty`: no cuestan otro viaje y
  //    completan lo que `getViewer()` necesita para no repetir la consulta.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, specialty")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== ROUTE_ROLES[protectedPrefix]) {
    // Rol incorrecto → a su propia área (o al login si no hay rol).
    return profile?.role
      ? redirect(request, `/${profile.role}`)
      : redirect(request, "/login");
  }

  // 5. Todo correcto. Se pasa la identidad ya validada al render, para que
  //    `getViewer()` no repita `auth.getUser()` ni la consulta a `profiles`.
  requestHeaders.set(VIEWER_HEADERS.id, user.id);
  requestHeaders.set(VIEWER_HEADERS.role, profile.role);
  if (user.email)
    requestHeaders.set(VIEWER_HEADERS.email, encodeHeaderValue(user.email));
  if (profile.full_name)
    requestHeaders.set(
      VIEWER_HEADERS.name,
      encodeHeaderValue(profile.full_name),
    );
  if (profile.specialty)
    requestHeaders.set(VIEWER_HEADERS.specialty, profile.specialty);

  // La respuesta se reconstruye una sola vez aquí, ya con las cabeceras, y se
  // arrastran las cookies que `updateSession` haya podido refrescar.
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of supabaseResponse.cookies.getAll())
    response.cookies.set(cookie);
  return response;
}

export const config = {
  // Las áreas con control de rol, MÁS las rutas /api que llaman a getViewer().
  // Estas últimas no llevan control de rol aquí (no están en ROUTE_ROLES, así
  // que salen por el paso 2 y conservan su 401 en JSON), pero DEBEN pasar por
  // el middleware para que se limpien las cabeceras de identidad. Si no, allí
  // serían falsificables. Ver el contrato en lib/auth-headers.ts.
  //
  // `/api/cron/*` queda fuera a propósito: se autentica con CRON_SECRET, no
  // con sesión, y no llama a getViewer().
  //
  // `:path*` cubre también la ruta base (p. ej. exactamente "/admin").
  matcher: [
    "/admin/:path*",
    "/trainer/:path*",
    "/client/:path*",
    "/api/client-documents/:path*",
    "/api/exercise-videos/:path*",
  ],
};
