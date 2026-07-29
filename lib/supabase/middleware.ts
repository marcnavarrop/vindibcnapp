import { createServerClient } from "@supabase/ssr";
import { stripViewerHeaders } from "@/lib/auth-headers";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refresca la sesión de Supabase en cada petición y deja las cookies
 * actualizadas tanto en la request (para el resto del pipeline) como en la
 * response (para el navegador). Devuelve el cliente y el usuario para que el
 * middleware raíz pueda aplicar el control de acceso por rol.
 *
 * IMPORTANTE: no metas lógica entre crear el cliente y `getUser()`; un fallo
 * ahí puede provocar cierres de sesión difíciles de depurar.
 */
export async function updateSession(request: NextRequest) {
  // Capçaleres que veurà el render. Es clonen i es NETEGEN aquí mateix, abans
  // de saber res de la sessió: així cap valor d'identitat enviat des de fora
  // pot arribar a la pàgina. Vegeu lib/auth-headers.ts.
  const requestHeaders = new Headers(request.headers);
  stripViewerHeaders(requestHeaders);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `requestHeaders` es retorna perquè el middleware hi pugui posar la
  // identitat validada i reconstruir la resposta una sola vegada al final.
  return { supabaseResponse, supabase, user, requestHeaders };
}
