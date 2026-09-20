"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createService,
  updateService,
  setServiceActive,
  type ServiceInput,
} from "@/lib/data/services";
import { SERVICE_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ServiceType } from "@/types/database";

function parse(formData: FormData): ServiceInput {
  return {
    serviceType: formData.get("serviceType") as ServiceType,
    name: String(formData.get("name") ?? "").trim(),
    price: Number(formData.get("price")),
    defaultSessions: Number(formData.get("defaultSessions")),
    // Les caselles NO s'envien quan no estan marcades: la presència del camp
    // és el valor. Mateix criteri que `active`, just a sobre.
    active: formData.get("active") != null,
    subscriptionOnly: formData.get("subscriptionOnly") != null,
  };
}

function validate(input: ServiceInput): string | null {
  if (!(input.serviceType in SERVICE_LABELS)) return "Tria un tipus de servei.";
  if (!input.name) return "El nom és obligatori.";
  if (!Number.isFinite(input.price) || input.price < 0)
    return "El preu no és vàlid.";
  if (!Number.isFinite(input.defaultSessions) || input.defaultSessions <= 0)
    return "Les sessions per defecte han de ser més grans que 0.";
  // Una «subscripció mensual a una sessió» no vol dir res: el que es renova
  // cada mes és un bo, i un bo d'una sessió no és un bo. Es para aquí perquè el
  // catàleg té paquets d'una sessió just al costat dels de subscripció —la
  // 'Sessió individual' de grup n'és un— i marcar-la per error és fàcil.
  if (input.subscriptionOnly && input.defaultSessions <= 1)
    return "Un paquet d'una sola sessió no pot anar per subscripció: la subscripció renova un bo cada mes.";
  return null;
}

export async function createServiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };
  try {
    await createService(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en crear." };
  }
  revalidatePath("/admin/serveis");
  redirect("/admin/serveis");
}

export async function updateServiceAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = parse(formData);
  const error = validate(input);
  if (error) return { error };
  try {
    await updateService(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar." };
  }
  revalidatePath("/admin/serveis");
  redirect("/admin/serveis");
}

export async function toggleServiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (id) await setServiceActive(id, active);
  revalidatePath("/admin/serveis");
}
