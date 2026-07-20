"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  uploadClientVideo,
  deleteClientVideo,
  validateVideoFile,
} from "@/lib/data/client-videos";

type VideoActionState = { error?: string; ok?: boolean };

export async function uploadClientVideoAction(
  clientId: string,
  revalidateRoute: string,
  _prev: VideoActionState,
  formData: FormData,
): Promise<VideoActionState> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { error: "No autoritzat." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Selecciona un fitxer de vídeo." };

  const validation = validateVideoFile(file);
  if (!validation.ok) return { error: validation.error };

  const description = String(formData.get("description") ?? "").trim() || undefined;

  try {
    await uploadClientVideo({
      clientId,
      uploadedBy: viewer.id,
      file,
      description,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en pujar el vídeo." };
  }

  revalidatePath(revalidateRoute);
  return { ok: true };
}

export async function deleteClientVideoAction(
  revalidateRoute: string,
  _prev: VideoActionState,
  formData: FormData,
): Promise<VideoActionState> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "trainer"))
    return { error: "No autoritzat." };

  const videoId = String(formData.get("videoId") ?? "");
  if (!videoId) return { error: "ID absent." };

  try {
    await deleteClientVideo(videoId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en eliminar el vídeo." };
  }

  revalidatePath(revalidateRoute);
  return { ok: true };
}
