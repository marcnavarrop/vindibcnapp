"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  hasOverlap,
  type PromotionInput,
} from "@/lib/data/promotions";
import type { DiscountType, PromotionScope, ServiceType } from "@/types/database";

export type OfertaFormState = { error?: string; overlap?: boolean };

function parseInput(fd: FormData): PromotionInput & { error?: string } {
  const name        = (fd.get("name") as string ?? "").trim();
  const discountType = fd.get("discountType") as DiscountType;
  const discountValue = parseFloat(fd.get("discountValue") as string ?? "");
  const scope        = fd.get("scope") as PromotionScope;
  const serviceType  = (fd.get("serviceType") as ServiceType | "") || null;
  const serviceId    = (fd.get("serviceId") as string | "") || null;
  const startsAt     = fd.get("startsAt") as string;
  const endsAt       = fd.get("endsAt") as string;
  const active       = fd.get("active") !== "false";

  if (!name) return { ...({} as PromotionInput), error: "El nom és obligatori." };
  if (!discountType || !["percentage", "fixed_amount"].includes(discountType))
    return { ...({} as PromotionInput), error: "Tipus de descompte invàlid." };
  if (isNaN(discountValue) || discountValue <= 0)
    return { ...({} as PromotionInput), error: "El valor del descompte ha de ser positiu." };
  if (discountType === "percentage" && discountValue > 100)
    return { ...({} as PromotionInput), error: "El percentatge no pot superar el 100%." };
  if (!startsAt || !endsAt)
    return { ...({} as PromotionInput), error: "Les dates són obligatòries." };
  if (endsAt < startsAt)
    return { ...({} as PromotionInput), error: "La data de fi ha de ser igual o posterior a l'inici." };
  if (scope === "service" && !serviceType)
    return { ...({} as PromotionInput), error: "Tria el tipus de servei." };
  if (scope === "package" && !serviceId)
    return { ...({} as PromotionInput), error: "Tria el paquet." };

  return {
    name,
    discountType,
    discountValue,
    scope,
    serviceType: scope === "service" ? serviceType : null,
    serviceId:   scope === "package" ? serviceId : null,
    startsAt,
    endsAt,
    active,
  };
}

export async function createOfertaAction(
  _prev: OfertaFormState,
  fd: FormData,
): Promise<OfertaFormState> {
  const input = parseInput(fd);
  if (input.error) return { error: input.error };

  const overlap = await hasOverlap({
    scope: input.scope,
    serviceType: input.serviceType,
    serviceId: input.serviceId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });

  // Creem igualment però avisem
  await createPromotion(input);
  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");

  if (overlap) {
    redirect("/admin/ofertes?overlap=1");
  }
  redirect("/admin/ofertes");
}

export async function updateOfertaAction(
  id: string,
  _prev: OfertaFormState,
  fd: FormData,
): Promise<OfertaFormState> {
  const input = parseInput(fd);
  if (input.error) return { error: input.error };

  const overlap = await hasOverlap({
    scope: input.scope,
    serviceType: input.serviceType,
    serviceId: input.serviceId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    excludeId: id,
  });

  await updatePromotion(id, input);
  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");

  if (overlap) {
    redirect("/admin/ofertes?overlap=1");
  }
  redirect("/admin/ofertes");
}

export async function toggleOfertaAction(fd: FormData): Promise<void> {
  const id     = fd.get("id") as string;
  const active = fd.get("active") === "true";
  await updatePromotion(id, { active });
  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");
}

export async function deleteOfertaAction(fd: FormData): Promise<void> {
  const id = fd.get("id") as string;
  await deletePromotion(id);
  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");
}
