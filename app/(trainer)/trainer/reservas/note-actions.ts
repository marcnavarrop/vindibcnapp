"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveSessionNote, deleteSessionNote } from "@/lib/data/session-notes";

export type NoteState = { error?: string; ok?: boolean };

/**
 * La sessió ha de començar abans que se'n pugui escriure la nota.
 *
 * Es comprova AQUÍ i no a la RLS a posta. La policy respon a "qui", que és la
 * frontera de seguretat; això és una regla de flux de treball —una nota sobre
 * una sessió que encara no ha passat és una errada, no una funcionalitat— i
 * les regles de flux es llegeixen molt millor al costat del formulari que dins
 * d'una policy. A més, `now()` no es pot fer servir en un `check` de Postgres.
 *
 * NO s'ha lligat a l'estat 'completed': aquell el marca el professional a mà
 * amb el botó "Fet" i moltes sessions no s'hi marquen mai. Lligar-hi la nota
 * l'hauria feta inabastable per un descuit.
 */
async function sessionHasStarted(reservationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("scheduled_at, status")
    .eq("id", reservationId)
    .maybeSingle();
  if (!data || data.status === "cancelled") return false;
  return new Date(data.scheduled_at).getTime() <= Date.now();
}

function revalidateAll() {
  revalidatePath("/trainer/reservas");
  revalidatePath("/admin/reservas");
  revalidatePath("/client/reservas");
}

/**
 * Desa la nota d'una sessió pròpia.
 *
 * Qui pot fer-ho de debò ho decideix `session_notes_trainer_write`: el
 * professional D'AQUELLA reserva. Aquesta acció no ho torna a comprovar per no
 * tenir dues fonts de veritat que puguin divergir; si la policy diu que no,
 * l'`upsert` falla i aquí es tradueix a un missatge.
 */
export async function saveSessionNoteAction(
  _prev: NoteState,
  formData: FormData,
): Promise<NoteState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "No s'ha pogut identificar el teu compte." };

  const reservationId = String(formData.get("reservationId") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!reservationId) return { error: "Reserva no trobada." };

  if (!(await sessionHasStarted(reservationId)))
    return { error: "Encara no pots escriure la nota d'una sessió que no ha començat." };

  const err = await saveSessionNote({
    reservationId,
    authorId: viewer.id,
    body,
  });
  if (err === "empty") return { error: "Escriu alguna cosa abans de desar." };
  if (err) return { error: "No s'ha pogut desar la nota." };

  revalidateAll();
  return { ok: true };
}

/** Esborra la nota. La RLS només ho deixa fer al professional d'aquella sessió. */
export async function deleteSessionNoteAction(formData: FormData) {
  const id = String(formData.get("reservationId") ?? "");
  if (!id) return;
  await deleteSessionNote(id);
  revalidateAll();
}
