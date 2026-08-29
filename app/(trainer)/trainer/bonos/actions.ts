"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getClient } from "@/lib/data/clients";
import { createBono, markBonoPaid, getBonoClientId } from "@/lib/data/bonos";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ServiceType } from "@/types/database";

/**
 * Alta de bono desde el área de entrenador/a. La RLS solo lo permite para sus
 * clientes asignados. No registra cobro aquí: el cobro se marca después con
 * `markTrainerBonoPaidAction`, cuando el cliente paga de verdad.
 */
export async function createTrainerBonoAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const serviceType = formData.get("serviceType") as ServiceType | null;
  const totalSessions = Number(formData.get("totalSessions"));
  const price = Number(formData.get("price"));

  if (!serviceType) return { error: "Tria un servei." };
  if (!Number.isFinite(totalSessions) || totalSessions <= 0)
    return { error: "El nre. de sessions ha de ser més gran que 0." };
  if (!Number.isFinite(price) || price < 0)
    return { error: "El preu no és vàlid." };

  try {
    await createBono({
      clientId,
      serviceType,
      totalSessions,
      price,
      paymentMethod: null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear el bo." };
  }

  revalidatePath(`/trainer/clients/${clientId}`);
  revalidatePath("/trainer/bonos");
  redirect(`/trainer/clients/${clientId}`);
}

/**
 * El professional marca com pagat un bo d'un client SEU.
 *
 * La comprovació es fa aquí i la RLS la torna a fer a la base. No és
 * redundància inútil: la política és el que de debò impedeix tocar el bo d'un
 * altre, però si l'única barrera fos aquella, forçar l'acció amb un id aliè
 * acabaria en un error de base de dades opac. Comprovant-ho abans, qui ho
 * intenti rep un "No autoritzat" i el bo no s'arriba ni a llegir.
 */
export async function markTrainerBonoPaidAction(
  formData: FormData,
): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;

  const bonoId = String(formData.get("bonoId") ?? "");
  if (!bonoId) return;

  // De quin client és aquest bo, i és un dels meus?
  const clientId = await getBonoClientId(bonoId);
  if (!clientId) return;
  const client = await getClient(clientId);
  if (!client || client.assignedTrainerId !== viewer.id) return;

  await markBonoPaid(bonoId);

  revalidatePath(`/trainer/clients/${clientId}`);
  revalidatePath("/trainer/bonos");
}
