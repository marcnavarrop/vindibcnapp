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

export type OfertaFormState = { error?: string };

function parseInput(fd: FormData): PromotionInput & { error?: string } {
  const name         = ((fd.get("name") as string) ?? "").trim();
  const discountType = (fd.get("discountType") as DiscountType) || null;
  const discountRaw  = fd.get("discountValue") as string;
  const discountValue = discountRaw ? parseFloat(discountRaw) : NaN;
  const scope        = (fd.get("scope") as PromotionScope) || null;
  const serviceType  = ((fd.get("serviceType") as string) || "") || null;
  const serviceId    = ((fd.get("serviceId") as string) || "") || null;
  const startsAt     = (fd.get("startsAt") as string) || "";
  const endsAt       = (fd.get("endsAt") as string) || "";
  const active       = fd.get("active") !== "false";

  if (!name)
    return { ...(null as unknown as PromotionInput), error: "El nom és obligatori." };
  if (!discountType || !["percentage", "fixed_amount"].includes(discountType))
    return { ...(null as unknown as PromotionInput), error: "Tipus de descompte invàlid." };
  if (isNaN(discountValue) || discountValue <= 0)
    return { ...(null as unknown as PromotionInput), error: "El valor del descompte ha de ser positiu." };
  if (discountType === "percentage" && discountValue > 100)
    return { ...(null as unknown as PromotionInput), error: "El percentatge no pot superar el 100%." };
  if (!scope || !["service", "package"].includes(scope))
    return { ...(null as unknown as PromotionInput), error: "L'àmbit és obligatori." };
  if (!startsAt || !endsAt)
    return { ...(null as unknown as PromotionInput), error: "Les dates són obligatòries." };
  if (endsAt < startsAt)
    return { ...(null as unknown as PromotionInput), error: "La data de fi ha de ser igual o posterior a l'inici." };
  if (scope === "service" && !serviceType)
    return { ...(null as unknown as PromotionInput), error: "Tria el tipus de servei." };
  if (scope === "package" && !serviceId)
    return { ...(null as unknown as PromotionInput), error: "Tria el paquet." };

  return {
    name,
    discountType,
    discountValue,
    scope,
    serviceType: scope === "service" ? (serviceType as ServiceType) : null,
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

  let overlap = false;
  try {
    overlap = await hasOverlap({
      scope: input.scope,
      serviceType: input.serviceType,
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
  } catch (err) {
    console.error("[createOfertaAction] hasOverlap error:", err);
    // No blocking — continue even if overlap check fails
  }

  try {
    await createPromotion(input);
  } catch (err) {
    console.error("[createOfertaAction] createPromotion error:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error desconegut en crear l'oferta.",
    };
  }

  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");
  revalidatePath("/client/bonos/comprar");

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

  let overlap = false;
  try {
    overlap = await hasOverlap({
      scope: input.scope,
      serviceType: input.serviceType,
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      excludeId: id,
    });
  } catch (err) {
    console.error("[updateOfertaAction] hasOverlap error:", err);
  }

  try {
    await updatePromotion(id, input);
  } catch (err) {
    console.error("[updateOfertaAction] updatePromotion error:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Error desconegut en actualitzar l'oferta.",
    };
  }

  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");
  revalidatePath("/client/bonos/comprar");

  if (overlap) {
    redirect("/admin/ofertes?overlap=1");
  }
  redirect("/admin/ofertes");
}

export async function toggleOfertaAction(fd: FormData): Promise<void> {
  const id     = fd.get("id") as string;
  const active = fd.get("active") === "true";
  try {
    await updatePromotion(id, { active });
  } catch (err) {
    console.error("[toggleOfertaAction] error:", err);
    throw err;
  }
  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");
  revalidatePath("/client/bonos/comprar");
}

export async function deleteOfertaAction(fd: FormData): Promise<void> {
  const id = fd.get("id") as string;
  try {
    await deletePromotion(id);
  } catch (err) {
    console.error("[deleteOfertaAction] error:", err);
    throw err;
  }
  revalidatePath("/admin/ofertes");
  revalidatePath("/admin/serveis");
  revalidatePath("/client/bonos/comprar");
}
