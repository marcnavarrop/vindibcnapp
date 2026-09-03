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
import { listActiveServices } from "@/lib/data/services";
import { listClientTags } from "@/lib/data/client-tags";
import { SERVICE_TYPES } from "@/lib/labels";
import type {
  DiscountType,
  PromotionAudience,
  PromotionScope,
  ServiceType,
} from "@/types/database";

export type OfertaFormState = { error?: string };

function isNextInternalError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = (err as { digest?: string }).digest ?? "";
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

type ParseResult = { ok: true; input: PromotionInput } | { ok: false; error: string };

async function parseInput(fd: FormData): Promise<ParseResult> {
  const name         = ((fd.get("name") as string) ?? "").trim();
  const discountType = (fd.get("discountType") as DiscountType) || null;
  const discountRaw  = fd.get("discountValue") as string;
  const discountValue = discountRaw ? parseFloat(discountRaw) : NaN;
  const scope        = (fd.get("scope") as PromotionScope) || null;
  const startsAt     = (fd.get("startsAt") as string) || "";
  const endsAt       = (fd.get("endsAt") as string) || "";
  const active       = fd.get("active") !== "false";

  // Arrays: FormData.getAll() retorna tots els valors per al mateix nom
  const serviceTypes = fd.getAll("serviceType").filter(Boolean) as ServiceType[];
  const serviceIds   = fd.getAll("serviceId").filter(Boolean) as string[];

  // Segmentació (0069). Sense el camp al formulari cau a 'all', que és el
  // comportament de sempre: cap oferta ja creada canvia de públic per descuit.
  const audience = ((fd.get("audience") as PromotionAudience) || "all");
  const audienceTagId = ((fd.get("audienceTagId") as string) || "").trim() || null;
  const audienceServiceType =
    ((fd.get("audienceServiceType") as string) || "").trim() || null;

  if (!name)
    return { ok: false, error: "El nom és obligatori." };
  if (!discountType || !["percentage", "fixed_amount"].includes(discountType))
    return { ok: false, error: "Tipus de descompte invàlid." };
  if (isNaN(discountValue) || discountValue <= 0)
    return { ok: false, error: "El valor del descompte ha de ser positiu." };
  if (discountType === "percentage" && discountValue > 100)
    return { ok: false, error: "El percentatge no pot superar el 100%." };
  if (!scope || !["service", "package"].includes(scope))
    return { ok: false, error: "L'àmbit és obligatori." };
  if (!startsAt || !endsAt)
    return { ok: false, error: "Les dates són obligatòries." };
  if (endsAt < startsAt)
    return { ok: false, error: "La data de fi ha de ser igual o posterior a l'inici." };
  if (scope === "service" && serviceTypes.length === 0)
    return { ok: false, error: "Tria almenys un tipus de servei." };
  if (scope === "package" && serviceIds.length === 0)
    return { ok: false, error: "Tria almenys un paquet." };

  if (!["all", "tag", "active_bono"].includes(audience))
    return { ok: false, error: "Públic de l'oferta invàlid." };
  if (audience === "tag" && !audienceTagId)
    return { ok: false, error: "Tria l'etiqueta a qui va dirigida l'oferta." };
  if (audience === "active_bono" && !audienceServiceType)
    return { ok: false, error: "Tria el tipus de servei del bo actiu." };
  if (
    audience === "active_bono" &&
    !(SERVICE_TYPES as string[]).includes(audienceServiceType!)
  )
    return { ok: false, error: "Tipus de servei invàlid." };

  // L'etiqueta és una FK de veritat (a diferència de service_ids), però es valida
  // igualment aquí: així l'admin veu un missatge en comptes d'un 23503 cru.
  if (audience === "tag" && audienceTagId) {
    const tags = await listClientTags();
    if (!tags.some((t) => t.id === audienceTagId))
      return { ok: false, error: "L'etiqueta triada ja no existeix." };
  }

  // Validació d'integritat de service_ids (substitueix FK nativa no suportada en arrays)
  if (scope === "package" && serviceIds.length > 0) {
    const allServices = await listActiveServices();
    const validIds = new Set(allServices.map((s) => s.id));
    const invalid = serviceIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0)
      return { ok: false, error: `Paquet(s) no vàlid(s): ${invalid.join(", ")}` };
  }

  return {
    ok: true,
    input: {
      name,
      discountType,
      discountValue,
      scope,
      serviceTypes: scope === "service" ? serviceTypes : [],
      serviceIds:   scope === "package" ? serviceIds : [],
      audience,
      audienceTagId: audience === "tag" ? audienceTagId : null,
      audienceServiceType:
        audience === "active_bono" ? (audienceServiceType as ServiceType) : null,
      startsAt,
      endsAt,
      active,
    },
  };
}

export async function createOfertaAction(
  _prev: OfertaFormState,
  fd: FormData,
): Promise<OfertaFormState> {
  try {
    const parsed = await parseInput(fd);
    if (!parsed.ok) return { error: parsed.error };
    const { input } = parsed;

    let overlap = false;
    try {
      overlap = await hasOverlap({
        scope: input.scope,
        serviceTypes: input.serviceTypes,
        serviceIds: input.serviceIds,
        audience: input.audience,
        audienceTagId: input.audienceTagId,
        audienceServiceType: input.audienceServiceType,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
    } catch (err) {
      console.error("[createOfertaAction] hasOverlap error:", err);
    }

    try {
      await createPromotion(input);
    } catch (err) {
      console.error("[createOfertaAction] createPromotion error:", err);
      return {
        error: err instanceof Error ? err.message : "Error desconegut en crear l'oferta.",
      };
    }

    revalidatePath("/admin/ofertes");
    revalidatePath("/admin/serveis");
    revalidatePath("/client/bonos");

    if (overlap) redirect("/admin/ofertes?overlap=1");
    redirect("/admin/ofertes");
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error("[createOfertaAction] UNHANDLED TOP-LEVEL ERROR:", err);
    return { error: err instanceof Error ? err.message : `Error inesperat: ${String(err)}` };
  }
}

export async function updateOfertaAction(
  id: string,
  _prev: OfertaFormState,
  fd: FormData,
): Promise<OfertaFormState> {
  try {
    const parsed = await parseInput(fd);
    if (!parsed.ok) return { error: parsed.error };
    const { input } = parsed;

    let overlap = false;
    try {
      overlap = await hasOverlap({
        scope: input.scope,
        serviceTypes: input.serviceTypes,
        serviceIds: input.serviceIds,
        audience: input.audience,
        audienceTagId: input.audienceTagId,
        audienceServiceType: input.audienceServiceType,
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
        error: err instanceof Error ? err.message : "Error desconegut en actualitzar l'oferta.",
      };
    }

    revalidatePath("/admin/ofertes");
    revalidatePath("/admin/serveis");
    revalidatePath("/client/bonos");

    if (overlap) redirect("/admin/ofertes?overlap=1");
    redirect("/admin/ofertes");
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error("[updateOfertaAction] UNHANDLED TOP-LEVEL ERROR:", err);
    return { error: err instanceof Error ? err.message : `Error inesperat: ${String(err)}` };
  }
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
  revalidatePath("/client/bonos");
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
  revalidatePath("/client/bonos");
}
