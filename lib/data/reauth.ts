import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Tornar a demanar la contrasenya abans d'una operació delicada, comprovada
 * AL SERVIDOR.
 *
 * PER QUÈ NO AL NAVEGADOR
 *
 * El formulari de contrasenya ho feia al client: `signInWithPassword` i, si
 * anava bé, l'operació. Això és un ressalt, no una barrera: qui tingui la
 * sessió oberta pot cridar l'acció del servidor directament i saltar-se el pas.
 * La comprovació ha de viure al mateix costat que decideix.
 *
 * COM
 *
 * Amb un client d'un sol ús que NO persisteix sessió. Qui diu si la contrasenya
 * val és Supabase, no el formulari.
 *
 * EL `scope: "local"` NO ÉS DECORATIU
 *
 * `signOut()` sense arguments val `scope: "global"` i revoca TOTES les sessions
 * de la persona: comprovar-li la contrasenya la tirava fora del seu propi
 * navegador i la tornava al login just després de l'operació. Vist a la prova
 * en producció del canvi de correu, no a cap test. Amb "local" només es tanca
 * la sessió que ha obert aquesta comprovació, que és el que volem: ni deixar-la
 * viva ni tocar la de ningú altre.
 */
export async function passwordIsCorrect(
  email: string,
  password: string,
): Promise<boolean> {
  if (!email || !password) return false;
  const probe = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return false;
  await probe.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}
