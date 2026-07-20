import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Service } from "@/lib/data/services";
import type { DiscountType, PromotionScope, ServiceType } from "@/types/database";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ─── Tipus ───────────────────────────────────────────────────────────────────

export type Promotion = {
  id: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  /** Llista de service_types quan scope='service'. Sempre [] si scope='package'. */
  serviceTypes: ServiceType[];
  /** Llista de service_ids quan scope='package'. Sempre [] si scope='service'. */
  serviceIds: string[];
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdAt: string;
};

export type EffectivePrice = {
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountLabel: string;
  hasDiscount: boolean;
  promotionName?: string;
};

// ─── Helpers interns ─────────────────────────────────────────────────────────

function rowToPromotion(r: {
  id: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  scope: PromotionScope;
  service_types: string[] | null;
  service_ids: string[] | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_at: string;
}): Promotion {
  return {
    id: r.id,
    name: r.name,
    discountType: r.discount_type,
    discountValue: Number(r.discount_value),
    scope: r.scope,
    serviceTypes: (r.service_types ?? []) as ServiceType[],
    serviceIds: r.service_ids ?? [],
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: r.active,
    createdAt: r.created_at,
  };
}

// ─── Càlcul de preu efectiu (funció pura, sense IO) ─────────────────────────

export function computeEffectivePrice(
  service: Service,
  promotions: Promotion[],
): EffectivePrice {
  const applicable = promotions.filter(
    (p) =>
      (p.scope === "package" && p.serviceIds.includes(service.id)) ||
      (p.scope === "service" && p.serviceTypes.includes(service.serviceType)),
  );

  if (applicable.length === 0) {
    return {
      originalPrice: service.price,
      finalPrice: service.price,
      discountAmount: 0,
      discountLabel: "",
      hasDiscount: false,
    };
  }

  let bestPromo = applicable[0];
  let bestSaving = 0;
  for (const p of applicable) {
    const saving =
      p.discountType === "percentage"
        ? (service.price * p.discountValue) / 100
        : p.discountValue;
    if (saving > bestSaving) {
      bestSaving = saving;
      bestPromo = p;
    }
  }

  const finalPrice = Math.max(0, Math.round(service.price - bestSaving));
  const discountLabel =
    bestPromo.discountType === "percentage"
      ? `-${bestPromo.discountValue}%`
      : `-${bestPromo.discountValue}€`;

  return {
    originalPrice: service.price,
    finalPrice,
    discountAmount: service.price - finalPrice,
    discountLabel,
    hasDiscount: true,
    promotionName: bestPromo.name,
  };
}

// ─── Accés a dades ───────────────────────────────────────────────────────────

export async function listPromotions(): Promise<Promotion[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    return (store.promotions ?? []).map(rowToPromotion);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPromotion);
}

export async function listActivePromotions(today: string): Promise<Promotion[]> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    return (store.promotions ?? [])
      .filter((p) => p.active && p.starts_at <= today && p.ends_at >= today)
      .map(rowToPromotion);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("active", true)
    .lte("starts_at", today)
    .gte("ends_at", today);
  if (error) throw error;
  return (data ?? []).map(rowToPromotion);
}

export async function getPromotion(id: string): Promise<Promotion | null> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    const p = (store.promotions ?? []).find((x) => x.id === id);
    return p ? rowToPromotion(p) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return rowToPromotion(data);
}

export type PromotionInput = {
  name: string;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  serviceTypes: ServiceType[];
  serviceIds: string[];
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export async function createPromotion(input: PromotionInput): Promise<string> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    if (!store.promotions) store.promotions = [];
    const id = crypto.randomUUID();
    store.promotions.push({
      id,
      name: input.name,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      scope: input.scope,
      service_types: input.scope === "service" ? input.serviceTypes : null,
      service_ids: input.scope === "package" ? input.serviceIds : null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      active: input.active,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return id;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("promotions")
    .insert({
      name: input.name,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      scope: input.scope,
      service_types: input.scope === "service" ? input.serviceTypes : null,
      service_ids: input.scope === "package" ? input.serviceIds : null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      active: input.active,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createPromotion] Supabase error:", error);
    throw new Error(error?.message ?? "No s'ha pogut crear l'oferta.");
  }
  return data.id;
}

export async function updatePromotion(
  id: string,
  input: Partial<PromotionInput>,
): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    const p = (store.promotions ?? []).find((x) => x.id === id);
    if (!p) throw new Error("Oferta no trobada.");
    if (input.name !== undefined) p.name = input.name;
    if (input.discountType !== undefined) p.discount_type = input.discountType;
    if (input.discountValue !== undefined) p.discount_value = input.discountValue;
    if (input.scope !== undefined) p.scope = input.scope;
    if (input.serviceTypes !== undefined)
      p.service_types = input.serviceTypes.length ? input.serviceTypes : null;
    if (input.serviceIds !== undefined)
      p.service_ids = input.serviceIds.length ? input.serviceIds : null;
    if (input.startsAt !== undefined) p.starts_at = input.startsAt;
    if (input.endsAt !== undefined) p.ends_at = input.endsAt;
    if (input.active !== undefined) p.active = input.active;
    saveStore(store);
    return;
  }

  const admin = createAdminClient();

  // Quan canvia el scope, cal netejar el camp que no s'usa.
  // Construïm l'objecte de forma explícita per satisfer el tipatge estricte de Supabase.
  const { error } = await admin
    .from("promotions")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.discountType !== undefined && { discount_type: input.discountType }),
      ...(input.discountValue !== undefined && { discount_value: input.discountValue }),
      ...(input.scope !== undefined && { scope: input.scope }),
      ...(input.serviceTypes !== undefined && {
        service_types: input.serviceTypes.length ? input.serviceTypes : null,
        service_ids: null,
      }),
      ...(input.serviceIds !== undefined && {
        service_ids: input.serviceIds.length ? input.serviceIds : null,
        service_types: null,
      }),
      ...(input.startsAt !== undefined && { starts_at: input.startsAt }),
      ...(input.endsAt !== undefined && { ends_at: input.endsAt }),
      ...(input.active !== undefined && { active: input.active }),
    })
    .eq("id", id);
  if (error) {
    console.error("[updatePromotion] Supabase error:", error);
    throw new Error(error.message ?? "No s'ha pogut actualitzar l'oferta.");
  }
}

export async function deletePromotion(id: string): Promise<void> {
  if (USE_MOCK) {
    const { getStore, saveStore } = await import("@/lib/mock/store");
    const store = getStore();
    if (!store.promotions) return;
    store.promotions = store.promotions.filter((x) => x.id !== id);
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("promotions").delete().eq("id", id);
  if (error) throw new Error("No s'ha pogut eliminar l'oferta.");
}

export async function getEffectivePrices(
  services: Service[],
  today?: string,
): Promise<Map<string, EffectivePrice>> {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const promotions = await listActivePromotions(todayStr);
  const result = new Map<string, EffectivePrice>();
  for (const s of services) {
    result.set(s.id, computeEffectivePrice(s, promotions));
  }
  return result;
}

export async function getEffectivePrice(
  service: Service,
  today?: string,
): Promise<EffectivePrice> {
  const map = await getEffectivePrices([service], today);
  return map.get(service.id)!;
}

/**
 * Comprova si una nova oferta es solaparia amb alguna d'existent.
 * Dues promocions es solapen si comparteixen dates I almenys un service_type
 * o service_id en comú (intersecció d'arrays).
 */
export async function hasOverlap(input: {
  scope: PromotionScope;
  serviceTypes: ServiceType[];
  serviceIds: string[];
  startsAt: string;
  endsAt: string;
  excludeId?: string;
}): Promise<boolean> {
  const all = await listPromotions();
  return all.some((p) => {
    if (input.excludeId && p.id === input.excludeId) return false;
    if (!p.active) return false;
    const datesOverlap = p.startsAt <= input.endsAt && p.endsAt >= input.startsAt;
    if (!datesOverlap) return false;
    if (input.scope === "package" && p.scope === "package")
      return input.serviceIds.some((id) => p.serviceIds.includes(id));
    if (input.scope === "service" && p.scope === "service")
      return input.serviceTypes.some((t) => p.serviceTypes.includes(t));
    return false;
  });
}
