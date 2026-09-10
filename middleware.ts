import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import {
  VIEWER_HEADERS,
  stripViewerHeaders,
  encodeHeaderValue,
  signViewerClaims,
} from "@/lib/auth-headers";
import type { Database } from "@/types/database";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  toLocale,
} from "@/lib/i18n/config";

type Role = Database["public"]["Enums"]["user_role"];

// Cada prefijo de ruta exige un rol concreto.
const ROUTE_ROLES: Record<string, Role> = {
  "/admin": "admin",
  "/trainer": "trainer",
  "/client": "client",
};

/**
 * Rutas que se autentican con un secreto PROPIO, no con una sesión: el
 * `CRON_SECRET` en el cron y la firma de Stripe en el webhook. No llaman a
 * `getViewer()` ni tienen cookies que refrescar.
 *
 * Siguen dentro del matcher —les limpiamos las cabeceras como a todas, que es
 * justamente el punto de que el matcher sea negativo— pero salen por la puerta
 * de al lado sin tocar Supabase. Así, si algún día una de ellas necesitara
 * identidad, la encontraría limpia en vez de falsificable.
 */
const SECRET_AUTH_PREFIXES = ["/api/cron", "/api/webhooks"];

/**
 * Rutas donde SÍ hay que refrescar la sesión de Supabase.
 *
 * Es la lista que antes era el matcher entero, y sigue siendo exactamente la
 * misma: las tres áreas con rol y las dos rutas de API que llaman a
 * `getViewer()`. Lo que ha cambiado es que ya no decide quién queda protegido
 * —eso ahora es universal— sino sólo dónde vale la pena gastar el viaje de red.
 *
 * Las páginas públicas nunca lo han hecho y siguen sin hacerlo: pasan con las
 * cabeceras limpias y sin coste añadido.
 */
const SESSION_PREFIXES = [
  "/admin",
  "/trainer",
  "/client",
  "/api/client-documents",
  "/api/exercise-videos",
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

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

  // ─────────────────── El invariante, antes que nada ───────────────────
  //
  // Las cabeceras de identidad se borran SIEMPRE y en TODAS las rutas, antes
  // de mirar la sesión, el rol o siquiera qué ruta es. No cuesta ningún viaje
  // de red y es lo único que impide que alguien diga quién es desde fuera.
  //
  // Va aquí arriba, y no dentro de cada rama, porque el fallo que arreglamos
  // fue exactamente ese: una rama por la que no se pasaba. Ver lib/auth-headers.ts.
  const cleanHeaders = new Headers(request.headers);
  stripViewerHeaders(cleanHeaders);
  const passThrough = () =>
    NextResponse.next({ request: { headers: cleanHeaders } });

  // Cron y webhooks: ya van limpias, y aquí no hay nada más que hacer.
  if (matchesPrefix(pathname, SECRET_AUTH_PREFIXES)) return passThrough();

  const protectedPrefix = protectedPrefixOf(pathname);

  // ───────────────────────── Modo simulación ─────────────────────────
  // Sin Supabase: el rol vive en una cookie que pone el login simulado.
  if (USE_MOCK) {
    if (!protectedPrefix) return passThrough();

    const role = request.cookies.get(MOCK_ROLE_COOKIE)?.value as
      | Role
      | undefined;

    if (!role) return redirect(request, "/login", pathname);
    if (role !== ROUTE_ROLES[protectedPrefix]) {
      return redirect(request, `/${role}`);
    }

    // Rol ya validado contra la cookie: se pasa al render, firmado igual que
    // en modo real para que `getViewer()` tenga un solo camino de confianza.
    const claims = {
      id: "",
      role,
      email: "",
      name: "",
      specialty: "",
    };
    const sig = await signViewerClaims(claims);
    if (sig) {
      cleanHeaders.set(VIEWER_HEADERS.role, role);
      cleanHeaders.set(VIEWER_HEADERS.sig, sig);
    }
    return NextResponse.next({ request: { headers: cleanHeaders } });
  }

  // ───────────────────────── Modo real (Supabase) ─────────────────────
  //
  // Rutas públicas: no hay sesión que refrescar ni rol que comprobar. Salen
  // con las cabeceras ya limpias, que es todo lo que necesitaban.
  if (!matchesPrefix(pathname, SESSION_PREFIXES)) return passThrough();

  // 1. Refresca la sesión (imprescindible para que la auth funcione).
  //    `requestHeaders` ya viene limpio de cabeceras de identidad.
  const { supabaseResponse, supabase, user, requestHeaders } =
    await updateSession(request);

  // 2. Ruta con sesión pero sin rol exigido (las dos de /api): se deja pasar
  //    con la sesión ya refrescada. No se pasa identidad, así que allí
  //    `getViewer()` hace su consulta completa, como siempre.
  if (!protectedPrefix) return supabaseResponse;

  // 3. Sin sesión → al login, recordando a dónde quería ir.
  if (!user) return redirect(request, "/login", pathname);

  // 4. Con sesión: comprobamos el rol contra la tabla profiles.
  //    Se piden también `full_name` y `specialty`: no cuestan otro viaje y
  //    completan lo que `getViewer()` necesita para no repetir la consulta.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, specialty, preferred_language")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== ROUTE_ROLES[protectedPrefix]) {
    // Rol incorrecto → a su propia área (o al login si no hay rol).
    return profile?.role
      ? redirect(request, `/${profile.role}`)
      : redirect(request, "/login");
  }

  // 5. Todo correcto. Se pasa la identidad ya validada al render, FIRMADA, para
  //    que `getViewer()` no repita `auth.getUser()` ni la consulta a `profiles`.
  //
  //    Si no hay clave para firmar no se pone ninguna: el render caerá al
  //    camino completo, que es más lento pero nunca incorrecto.
  const claims = {
    id: user.id,
    role: profile.role,
    email: user.email ? encodeHeaderValue(user.email) : "",
    name: profile.full_name ? encodeHeaderValue(profile.full_name) : "",
    specialty: profile.specialty ?? "",
  };
  const sig = await signViewerClaims(claims);
  if (sig) {
    requestHeaders.set(VIEWER_HEADERS.id, claims.id);
    requestHeaders.set(VIEWER_HEADERS.role, claims.role);
    if (claims.email) requestHeaders.set(VIEWER_HEADERS.email, claims.email);
    if (claims.name) requestHeaders.set(VIEWER_HEADERS.name, claims.name);
    if (claims.specialty)
      requestHeaders.set(VIEWER_HEADERS.specialty, claims.specialty);
    requestHeaders.set(VIEWER_HEADERS.sig, sig);
  }

  // La respuesta se reconstruye una sola vez aquí, ya con las cabeceras, y se
  // arrastran las cookies que `updateSession` haya podido refrescar.
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of supabaseResponse.cookies.getAll())
    response.cookies.set(cookie);

  // La cookie d'idioma es posa al dia amb el perfil.
  //
  // És aquí i no al login perquè el perfil JA s'ha llegit en aquesta mateixa
  // consulta: no costa cap viatge extra. I com que passa a cada navegació
  // protegida, s'arregla sola —qui entra des d'un altre dispositiu, o qui va
  // canviar l'idioma abans que això existís, la té bé al primer clic.
  //
  // Només el CLIENT: l'admin i el professional treballen en català fix i no
  // volem que la seva preferència personal decideixi l'idioma de les pàgines
  // públiques que visitin després.
  if (profile.role === "client") {
    const preferred = toLocale(profile.preferred_language);
    if (request.cookies.get(LOCALE_COOKIE)?.value !== preferred)
      response.cookies.set(LOCALE_COOKIE, preferred, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
      });
  }

  return response;
}

export const config = {
  /**
   * MATCHER NEGATIVO: el middleware corre en TODAS las rutas menos los ficheros
   * estáticos. Ésta es la corrección de fondo del fallo de suplantación.
   *
   * Antes era una lista positiva (/admin, /trainer, /client y dos de /api) y el
   * contrato de lib/auth-headers.ts pedía que quien añadiese una ruta que llama
   * a `getViewer()` se acordara de meterla aquí. No se cumplió: `setLocaleAction`
   * acabó montada en /login, /register y /prova —tres páginas fuera del
   * matcher—, donde nadie limpiaba las cabeceras y una petición sin ninguna
   * cookie podía declararse cliente y escribir con la clave de servicio.
   *
   * Con la lista negativa, olvidarse ya no abre nada: una ruta nueva entra
   * protegida por defecto y hay que excluirla A PROPÓSITO para dejarla fuera.
   * El descuido falla hacia el lado seguro, que es la única clase de descuido
   * que un proyecto se puede permitir.
   *
   * QUÉ QUEDA FUERA, Y POR QUÉ SÓLO ESTO
   *
   * Únicamente lo que no puede ejecutar código nuestro: los internos de Next
   * (`_next/static`, `_next/image`), el favicon y los ficheros con extensión de
   * imagen o de fuente, que es lo que hay en `public/`. Ninguno de ellos puede
   * llamar a `getViewer()`, así que excluirlos no reabre nada.
   *
   * `/api/cron` y `/api/webhooks` NO se excluyen aquí, aunque no necesiten
   * sesión: entran, se les limpian las cabeceras y salen por `SECRET_AUTH_PREFIXES`
   * sin gastar un solo viaje a Supabase. Dejarlas fuera del matcher habría sido
   * volver a tener rutas donde las cabeceras son falsificables —hoy no lo notaría
   * nadie porque no llaman a `getViewer()`, y eso es precisamente lo que hacía
   * invisible el fallo anterior.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
