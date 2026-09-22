import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";

/**
 * Què li queda per mirar dels seus exercicis, i quan hi va entrar per últim cop.
 *
 * EL TALL
 *
 * Una data per client (`exercises_seen`, 0089) contra l'`assigned_at` que
 * `client_exercises` (0012) ja desava. El marcatge és «en entrar a la
 * pantalla, tot vist», de manera que una taula de (client × exercici)
 * guardaria N files per dir el que diu una data.
 *
 * LA DIFERÈNCIA AMB COMUNITAT, QUE NO ÉS UN DESCUIT
 *
 * Allà, un client sense fila té com a tall la seva alta i prou: els anuncis
 * del centre són anteriors a l'alta de tothom, així que ningú es troba
 * l'històric encès. Els exercicis assignats són POSTERIORS a l'alta per
 * definició —primer entres, després el teu professional et posa feina—, i amb
 * el mateix criteri tots els clients d'avui haurien estrenat la piloteta amb
 * la seva biblioteca sencera a dins. Per això la 0089 sembra una fila per
 * client existent; el `?? clientCreatedAt` d'aquí queda per als clients NOUS,
 * que encara no tenen cap exercici i per als quals sí que és el tall bo.
 *
 * VA PER LA SESSIÓ DEL CLIENT, NO PER `service_role`
 *
 * Com a `community-seen.ts`: el que impedeix que un client mogui el marcador
 * d'un altre és la RLS de la 0089, i amb `service_role` aquella comprovació no
 * arribaria a córrer mai. La garantia la dona la base.
 */

/** Exercicis assignats a aquest client després de l'última visita seva. */
export async function countUnreadExercises(
  clientId: string,
  /**
   * L'alta del client, que és el tall quan encara no té fila. La hi dona qui
   * crida, que ja la porta de la consulta amb què ha resolt el `clientId`.
   */
  clientCreatedAt: string,
): Promise<number> {
  if (USE_MOCK) {
    const store = getStore();
    const seen =
      store.exercises_seen.find((r) => r.client_id === clientId)?.seen_at ??
      clientCreatedAt;
    return store.client_exercises.filter(
      (ce) => ce.client_id === clientId && ce.assigned_at > seen,
    ).length;
  }

  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("exercises_seen")
    .select("seen_at")
    .eq("client_id", clientId)
    .maybeSingle();

  // Si el marcador no es POT llegir, no hi ha piloteta. I l'`error` es mira a
  // posta, que aquí és la diferència entre callar i cridar:
  //
  // supabase-js no llança quan la taula no existeix, torna `{ data: null,
  // error }`. Ignorant-lo, "no hi ha fila" i "no hi ha taula" es confonen, i
  // les dues cauen al tall de l'alta del client. Per a un client NOU això és
  // correcte —encara no té cap exercici—; amb la taula absent vol dir que
  // TOTS els clients estrenarien la piloteta amb la seva biblioteca sencera,
  // que és precisament el que la sembra de la 0089 existeix per evitar.
  //
  // No és hipotètic: el codi arriba a producció abans que la migració
  // s'apliqui a mà. Amb això, entremig la piloteta simplement no surt.
  if (error) return 0;

  const seen = row?.seen_at ?? clientCreatedAt;
  if (!seen) return 0;

  // `head: true` amb `count: exact`: no baixa ni una fila, només el número.
  // Va sobre `idx_client_exercises_client` (0012), que ja hi era.
  const { count } = await supabase
    .from("client_exercises")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gt("assigned_at", seen);

  return count ?? 0;
}

/**
 * Deixa constància que aquest client acaba de mirar els seus exercicis.
 *
 * És un UPSERT, i per això la 0089 té polítiques d'INSERT i d'UPDATE per
 * separat: amb només la d'alta, la primera visita funcionaria i la segona
 * fallaria en silenci —la fila ja hi seria— i la piloteta no s'apagaria mai
 * més sense que res es queixés.
 */
export async function markExercisesSeen(clientId: string): Promise<void> {
  const now = new Date().toISOString();

  if (USE_MOCK) {
    const store = getStore();
    const row = store.exercises_seen.find((r) => r.client_id === clientId);
    if (row) row.seen_at = now;
    else store.exercises_seen.push({ client_id: clientId, seen_at: now });
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises_seen")
    .upsert({ client_id: clientId, seen_at: now }, { onConflict: "client_id" });
  if (error) throw error;
}
