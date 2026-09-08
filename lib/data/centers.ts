import "server-only";
import { createClient } from "@/lib/supabase/server";
import { USE_MOCK } from "@/lib/config";

/**
 * Registre de noms de centres (0080).
 *
 * Fase 1 del multi-centre i, de moment, tota la funció: una llista de noms que
 * l'administració manté. NO la llegeix ningú més. Cap client, professional,
 * servei ni reserva hi apunta, i l'app segueix operant com un sol centre.
 *
 * Si véns a enganxar-hi alguna cosa, aquell és el moment de la fase de
 * repartiment de dades, que és una feina a part amb el seu propi disseny.
 *
 * `center_settings` (lib/data/center-settings.ts) NO té res a veure: és el
 * singleton global d'horaris i política de cancel·lació. Es diuen semblant
 * perquè "centre" és la paraula de la casa, no perquè una pengi de l'altra.
 *
 * El permís el posa la RLS: totes les consultes van amb el client de SESSIÓ, i
 * les policies de la 0080 només deixen passar l'admin. Els `getViewer()` de les
 * accions no són el pany.
 */

export type Center = {
  id: string;
  name: string;
  createdAt: string;
};

/** Límits del nom. Els mateixos que el `check` de la 0080. */
const MAX_NAME = 80;

function cleanName(name: string): string {
  return name.trim();
}

/** Els centres, del més antic al més nou: el primer de la llista és el de sempre. */
export async function listCenters(): Promise<Center[]> {
  if (USE_MOCK) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("centers")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.created_at,
  }));
}

/** Dona d'alta un centre. Torna el seu id. */
export async function createCenter(name: string): Promise<string> {
  const clean = cleanName(name);
  if (!clean) throw new Error("El nom del centre no pot ser buit.");
  if (clean.length > MAX_NAME)
    throw new Error(`El nom del centre és massa llarg (màxim ${MAX_NAME}).`);
  if (USE_MOCK) throw new Error("No disponible en mode demostració.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("centers")
    .insert({ name: clean })
    .select("id")
    .single();
  if (error) {
    // 23505 = l'índex únic de la 0080, que ignora majúscules i espais.
    if (error.code === "23505") throw new Error("Ja hi ha un centre amb aquest nom.");
    throw new Error(error.message ?? "No s'ha pogut crear el centre.");
  }
  return data.id;
}

/** Canvia el nom d'un centre. No n'esborra cap: la 0080 no ho permet. */
export async function renameCenter(id: string, name: string): Promise<void> {
  const clean = cleanName(name);
  if (!clean) throw new Error("El nom del centre no pot ser buit.");
  if (clean.length > MAX_NAME)
    throw new Error(`El nom del centre és massa llarg (màxim ${MAX_NAME}).`);
  if (USE_MOCK) throw new Error("No disponible en mode demostració.");

  const supabase = await createClient();
  const { error } = await supabase.from("centers").update({ name: clean }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Ja hi ha un centre amb aquest nom.");
    throw new Error(error.message ?? "No s'ha pogut reanomenar el centre.");
  }
}
