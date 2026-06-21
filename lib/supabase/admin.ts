import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente de Supabase con la clave service_role. Salta toda la RLS y permite
 * usar la Admin API de Auth (crear usuarios). SOLO servidor: nunca importar
 * esto desde un componente cliente.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
