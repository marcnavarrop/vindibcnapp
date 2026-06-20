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

  if (!serviceType) return { error: "Elige un servicio." };
  if (!Number.isFinite(totalSessions) || totalSessions <= 0)
    return { error: "El nº de sesiones debe ser mayor que 0." };
  if (!Number.isFinite(price) || price < 0)
    return { error: "El precio no es válido." };

  try {
    await createBono({ clientId, serviceType, totalSessions, price });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear el bono." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/bonos");
  redirect(`/admin/clients/${clientId}`);
}
