"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { reassignClientTrainer } from "@/lib/data/clients";

export type AssignTrainerState = {
  error?: string;
  /**
   * Marca de temps de l'últim desat correcte, no un booleà.
   *
   * El formulari refresca la pantalla quan aquest valor canvia. Amb un `ok:
   * true` el segon desat seguit no canviava res i el refresc no s'arribava a
   * disparar: es quedava ensenyant l'entrenador anterior.
   */
  savedAt?: number;
};

/**
 * Canvia l'entrenador assignat d'un client.
 *
 * Qualsevol professional pot moure qualsevol client, no només els seus: al
 * centre les baixes, les vacances i els canvis d'horari es resolen entre ells i
 * no tenia sentit haver d'esperar l'administració per a un camp.
 *
 * L'autorització és aquesta comprovació de rol i prou. Es fa aquí, i no a la
 * RLS, perquè la política de `clients` que deixaria fer-ho també obriria
 * l'edició de les notes clíniques —dades de salut— de tothom, i això sí que ha
 * de seguir acotat als clients propis. `reassignClientTrainer()` escriu només
 * aquest camp, de manera que el permís que es dóna aquí no arriba enlloc més.
 *
 * Sense registre de qui ha fet el canvi: decisió presa.
 */
export async function reassignClientTrainerAction(
  _prev: AssignTrainerState,
  formData: FormData,
): Promise<AssignTrainerState> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { error: "No tens permís per reassignar clients." };

  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!clientId) return { error: "Falta el client." };
  // Desplegable buit = deixar-lo sense assignar, que és un estat vàlid.
  const trainerId = String(formData.get("trainerId") ?? "").trim() || null;

  try {
    await reassignClientTrainer(clientId, trainerId);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut desar el canvi.",
    };
  }

  // Les dues llistes i les dues fitxes: qui ho canvia pot venir de qualsevol
  // de les dues àrees, i el nom de l'entrenador surt a totes quatre.
  revalidatePath("/trainer/clients");
  revalidatePath(`/trainer/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  return { savedAt: Date.now() };
}
