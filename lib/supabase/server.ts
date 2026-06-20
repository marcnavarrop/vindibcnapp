import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Cliente de Supabase para el servidor (Server Components, Route Handlers,
 * Server Actions). Lee y escribe la sesión desde las cookies de la petición.
 *
 * En Next.js 15 `cookies()` es asíncrono, por eso la función es `async`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` puede llamarse desde un Server Component, donde no se
            // pueden escribir cookies. Es seguro ignorarlo: el middleware
            // refresca la sesión en cada petición.
          }
        },
      },
    },
  );
}
