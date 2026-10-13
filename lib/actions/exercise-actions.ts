"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import {
  createExercise,
  updateExercise,
  getExercise,
  deleteExercise,
  type ExerciseInput,
} from "@/lib/data/exercises";
import {
  createPendingVideoUpload,
  finalizePendingVideo,
  type PendingUpload,
} from "@/lib/data/exercise-videos";
import { isPendingVideoPath } from "@/lib/exercise-video.constants";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

/**
 * Accions de la biblioteca d'exercicis, compartides per l'admin i el
 * professional.
 *
 * `basePath` ve lligat des de cada pàgina ("/admin/exercicis" o
 * "/trainer/exercicis") perquè la redirecció i la revalidació acabin a l'àrea
 * de qui les fa servir. La resta és idèntica: la RLS `exercises_write` (0003)
 * ja donava permís als dos rols des del principi; només no s'havia ensenyat mai
 * a la interfície del professional.
 */

/**
 * Qui pot tocar la biblioteca. La RLS ja ho impedeix a un client, però una
 * acció de servidor exposada ha de dir que no ella mateixa i amb un missatge,
 * no deixar que rebori una política tres capes més avall.
 */
async function assertCanManage(): Promise<string | null> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return "No autoritzat.";
  return null;
}

async function parse(formData: FormData): Promise<{ input: ExerciseInput } | { error: string }> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const videoMode = str("videoMode"); // "url" | "file" | ""
  const videoUrl = videoMode === "url" ? str("videoUrl") || null : null;

  let videoFilePath: string | null = null;
  if (videoMode === "file") {
    // El vídeo nou ja és a Storage (`pending/…`): el navegador l'hi ha pujat
    // directament. Aquí només arriba el camí; el mou a la carpeta de
    // l'exercici qui crida, quan ja en té l'id.
    const uploaded = str("uploadedVideoPath");
    if (uploaded && !isPendingVideoPath(uploaded))
      return { error: "El vídeo pujat no és vàlid. Torna'l a triar." };
    // Sense vídeo nou, es conserva el que ja tenia l'exercici.
    videoFilePath = uploaded ? null : str("existingVideoFilePath") || null;
  }

  return {
    input: {
      name: str("name"),
      categoryId: str("category"),
      description: str("description") || null,
      videoUrl,
      videoFilePath,
    },
  };
}

function validate(input: ExerciseInput): string | null {
  if (!input.name) return "El nom és obligatori.";
  // Que la categoria existeixi ho garanteix la clau forana de la 0057: aquí
  // només cal que se n'hagi triat una.
  if (!input.categoryId) return "Tria una categoria.";
  return null;
}

export async function createExerciseAction(
  basePath: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const denied = await assertCanManage();
  if (denied) return { error: denied };

  const parsed = await parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { input } = parsed;

  const err = validate(input);
  if (err) return { error: err };

  // Creem primer l'exercici per tenir l'id
  let exerciseId: string;
  try {
    exerciseId = await createExercise(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear." };
  }

  // El vídeo pujat a `pending/`, ara que hi ha id, a la carpeta de l'exercici.
  const uploaded = String(formData.get("uploadedVideoPath") ?? "");
  if (String(formData.get("videoMode") ?? "") === "file" && uploaded) {
    try {
      const path = await finalizePendingVideo(exerciseId, uploaded);
      await updateExercise(exerciseId, { ...input, videoFilePath: path });
    } catch (e) {
      // L'exercici ja s'ha creat; el vídeo no. Es diu, i es pot afegir editant-lo.
      return {
        error: `L'exercici s'ha creat, però el vídeo no: ${e instanceof Error ? e.message : "error desconegut."} Edita'l per tornar-lo a afegir.`,
      };
    }
  }

  revalidatePath(basePath);
  redirect(basePath);
}

export async function updateExerciseAction(
  basePath: string,
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const denied = await assertCanManage();
  if (denied) return { error: denied };

  const parsed = await parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { input } = parsed;

  const err = validate(input);
  if (err) return { error: err };

  // Obtenim el path actual per saber si cal esborrar-lo
  const existing = await getExercise(id);
  const oldPath = existing?.videoFilePath ?? null;

  // Vídeo nou (ja pujat a `pending/`): a la carpeta de l'exercici. Sense, el
  // `existingVideoFilePath` ja ve del parse.
  const uploaded = String(formData.get("uploadedVideoPath") ?? "");
  if (String(formData.get("videoMode") ?? "") === "file" && uploaded) {
    try {
      input.videoFilePath = await finalizePendingVideo(id, uploaded);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No s'ha pogut desar el vídeo." };
    }
  }

  try {
    await updateExercise(id, input, oldPath);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }

  revalidatePath(basePath);
  redirect(basePath);
}

export async function deleteExerciseAction(basePath: string, formData: FormData) {
  if (await assertCanManage()) return;
  const id = String(formData.get("id") ?? "");
  if (id) await deleteExercise(id);
  revalidatePath(basePath);
}

/**
 * Permís per pujar el vídeo d'un exercici directament a Storage.
 *
 * Només professionals i admin. Rep el que diu el navegador del fitxer (nom,
 * mida, tipus), ho comprova i torna on pujar-lo. El fitxer no passa per aquí:
 * el navegador el puja directament, sense el límit de 4,5 MB de Vercel. En
 * desar l'exercici es torna a comprovar el fitxer de debò.
 */
export async function requestExerciseVideoUploadAction(file: {
  name: string;
  size: number;
  type: string;
}): Promise<{ ok: true; upload: PendingUpload } | { ok: false; error: string }> {
  const denied = await assertCanManage();
  if (denied) return { ok: false, error: denied };
  try {
    return {
      ok: true,
      upload: await createPendingVideoUpload({
        name: String(file?.name ?? ""),
        size: Number(file?.size ?? 0),
        type: String(file?.type ?? ""),
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No s'ha pogut preparar la pujada." };
  }
}
