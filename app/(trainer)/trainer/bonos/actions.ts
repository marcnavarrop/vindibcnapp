"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createBono, markBonoPaid, getBonoClientId, cancelBono } from "@/lib/data/bonos";
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
 * El professional marca com pagat un bo de QUALSEVOL client.
 *
 * Fins a la 0085 només podia cobrar els dels seus assignats. Qui té la persona
 * al davant amb els diners a la mà no sempre és qui la té assignada —es
 * cobreixen baixes, es reparteixen hores—, i el criteri de la casa ja era que
 * es veu tot el centre per coordinar-se. Cobrar passa al costat de veure.
 *
 * El que segueix igual: crear un bo o gestionar la resta de la fitxa continua
 * essent només per als clients propis. Això ho amplia la política
 * `bonos_trainer_collect_any`, que fixa d'on pot venir el bo i on ha d'acabar.
 */
export async function markTrainerBonoPaidAction(
  formData: FormData,
): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;

  const bonoId = String(formData.get("bonoId") ?? "");
  if (!bonoId) return;

  // El client ja no decideix si es pot cobrar, però sí quina fitxa s'ha de
  // refrescar: el bo cobrat hi surt amb l'estat nou.
  const clientId = await getBonoClientId(bonoId);

  await markBonoPaid(bonoId);

  if (clientId) revalidatePath(`/trainer/clients/${clientId}`);
  revalidatePath("/trainer/bonos");
}

/**
 * El professional anul·la un bo PENDENT de pagament.
 *
 * `isAdmin: false` no és una formalitat: és el que fa que un bo ja cobrat
 * reboti aquí. Anul·lar-ne un d'actiu vol dir deixar diners cobrats al llibre
 * sense res que ho compensi —a `payments` no hi ha manera d'anotar una
 * devolució—, i això és de l'administració. La regla sencera viu a
 * `cancelBlockFor` i la torna a comprovar la RLS de la 0085.
 */
export async function cancelTrainerBonoAction(
  formData: FormData,
): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return;

  const bonoId = String(formData.get("bonoId") ?? "");
  if (!bonoId) return;

  const clientId = await getBonoClientId(bonoId);

  await cancelBono(bonoId, { isAdmin: false });

  if (clientId) revalidatePath(`/trainer/clients/${clientId}`);
  revalidatePath("/trainer/bonos");
}
