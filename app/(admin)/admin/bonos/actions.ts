"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createBono } from "@/lib/data/bonos";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ServiceType } from "@/types/database";

export async function createBonoAction(
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
    await createBono({ clientId, serviceType, totalSessions, price });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear el bo." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/bonos");
  redirect(`/admin/clients/${clientId}`);
}
