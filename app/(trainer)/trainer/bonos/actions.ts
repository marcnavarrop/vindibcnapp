"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createBono, markBonoPaid, getBonoClientId, cancelBono } from "@/lib/data/bonos";
import { getClient } from "@/lib/data/clients";
import { subscribeAtCenter } from "@/lib/data/subscription-renewal";
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
  // Mateix motiu que a l'acció d'admin: `createBono` mira la casella del
  // paquet, i des de la 0086 això no es pot deduir del tipus de servei.
  const serviceId = String(formData.get("serviceId") ?? "");
  const totalSessions = Number(formData.get("totalSessions"));
  const price = Number(formData.get("price"));

  if (!serviceType || !serviceId) return { error: "Tria un servei." };
  if (!Number.isFinite(totalSessions) || totalSessions <= 0)
    return { error: "El nre. de sessions ha de ser més gran que 0." };
  if (!Number.isFinite(price) || price < 0)
    return { error: "El preu no és vàlid." };

  try {
    await createBono({
      clientId,
      serviceType,
      serviceId,
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
 * El professional subscriu un dels SEUS clients a un paquet de grup, al centre.
 *
 * Mateixa alta que fa l'admin i que fa el client: `subscribeAtCenter`. El que
 * canvia és qui hi pot arribar, i per això la comprovació d'assignació es
 * repeteix aquí i no es deixa només a la pàgina: crear un bo per a un client
 * que no és seu ja rebota per RLS, però una subscripció s'escriu amb la clau de
 * servei —la política de la 0072 només deixa escriure l'admin— i allà no hi
 * hauria cap segona barrera. La condició és exactament la de
 * `createTrainerBonoAction`: només els propis.
 *
 * Amb targeta no hi ha equivalent. El Checkout demana que el client tecleji la
 * seva; per aquell camí ha d'entrar ell a /client/bonos.
 */
export async function createTrainerGroupSubscriptionAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") return { error: "No autoritzat." };

  const client = await getClient(clientId);
  if (!client || client.assignedTrainerId !== viewer.id)
    return { error: "Aquest client no és teu." };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { error: "Tria un paquet." };

  try {
    await subscribeAtCenter({ clientId, serviceId });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error en donar d'alta la subscripció.",
    };
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
