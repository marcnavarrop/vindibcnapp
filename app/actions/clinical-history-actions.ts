"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getClient } from "@/lib/data/clients";
import {
  addFollowup,
  deleteFollowup,
  editFollowup,
  getFollowupMeta,
  logClinicalView,
  markClinicalSeen,
  saveFirstVisit,
} from "@/lib/data/clinical-history";
import {
  canDeleteClinical,
  canEditFollowup,
  canReadClinical,
  canWriteClinical,
} from "@/lib/clinical-access";

/**
 * L'HISTORIAL CLÍNIC (0110), des de les fitxes de l'admin i del professional.
 *
 * Cada acció mira el permís amb la regla pura (`lib/clinical-access.ts`) i la
 * base el torna a mirar amb la RLS: escriuen amb la sessió de qui crida, mai
 * amb la clau de servei (llevat del registre d'accessos, com l'exportació).
 */

export type ClinicalFormState = { error?: string; ok?: boolean };

function refresh(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/trainer/clients/${clientId}`);
}

async function subjectOf(clientId: string) {
  const c = await getClient(clientId);
  return c ? { id: c.id, assignedTrainerId: c.assignedTrainerId, profileId: c.profileId, fullName: c.fullName } : null;
}

export async function saveFirstVisitAction(
  clientId: string,
  _prev: ClinicalFormState,
  fd: FormData,
): Promise<ClinicalFormState> {
  const viewer = await requireRole("admin", "trainer");
  if (!viewer) return { error: "No autoritzat." };
  const client = await subjectOf(clientId);
  if (!client || !canWriteClinical(viewer, client))
    return { error: "No pots escriure l'historial d'aquest client." };
  try {
    await saveFirstVisit(clientId, String(fd.get("body") ?? ""), viewer.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No s'ha pogut desar." };
  }
  refresh(clientId);
  return { ok: true };
}

export async function addFollowupAction(
  clientId: string,
  _prev: ClinicalFormState,
  fd: FormData,
): Promise<ClinicalFormState> {
  const viewer = await requireRole("admin", "trainer");
  if (!viewer) return { error: "No autoritzat." };
  const client = await subjectOf(clientId);
  if (!client || !canWriteClinical(viewer, client))
    return { error: "No pots escriure l'historial d'aquest client." };
  try {
    await addFollowup(clientId, String(fd.get("body") ?? ""), viewer.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No s'ha pogut desar." };
  }
  refresh(clientId);
  return { ok: true };
}

export async function editFollowupAction(
  _prev: ClinicalFormState,
  fd: FormData,
): Promise<ClinicalFormState> {
  const viewer = await requireRole("admin", "trainer");
  if (!viewer) return { error: "No autoritzat." };
  const id = String(fd.get("id") ?? "");
  const meta = id ? await getFollowupMeta(id) : null;
  if (!meta) return { error: "Aquest seguiment ja no existeix." };
  const client = await subjectOf(meta.clientId);
  if (!client || !canEditFollowup(viewer, client, meta.authorId))
    return { error: "Aquest seguiment només el pot editar qui el va escriure o l'administració." };
  try {
    await editFollowup(id, String(fd.get("body") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No s'ha pogut desar." };
  }
  refresh(meta.clientId);
  return { ok: true };
}

export async function deleteFollowupAction(
  _prev: ClinicalFormState,
  fd: FormData,
): Promise<ClinicalFormState> {
  const viewer = await requireRole("admin");
  if (!viewer) return { error: "Només l'administració pot esborrar." };
  if (!canDeleteClinical(viewer)) return { error: "Només l'administració pot esborrar." };
  const id = String(fd.get("id") ?? "");
  const meta = id ? await getFollowupMeta(id) : null;
  if (!meta) return { error: "Aquest seguiment ja no existeix." };
  try {
    await deleteFollowup(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No s'ha pogut esborrar." };
  }
  refresh(meta.clientId);
  return { ok: true };
}

/**
 * L'historial s'ha obert de debò (la pestanya s'ha vist, no només carregat):
 * es marca com a vist per a qui mira i, si no és l'admin ni el Client Demo,
 * queda una fila al registre d'accessos. Mai falla cap a la pantalla.
 */
export async function clinicalHistoryOpenedAction(clientId: string): Promise<void> {
  const viewer = await requireRole("admin", "trainer");
  if (!viewer) return;
  try {
    const client = await subjectOf(clientId);
    if (!client || !canReadClinical(viewer, client)) return;
    await Promise.all([
      markClinicalSeen(clientId, viewer.id),
      logClinicalView({
        viewer,
        clientId,
        clientProfileId: client.profileId,
        clientName: client.fullName,
      }),
    ]);
  } catch (e) {
    console.error("[historial] obrir:", e);
  }
}
