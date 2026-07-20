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
  serviceType: ServiceType | null;
  serviceId: string | null;
  startsAt: string;  // "YYYY-MM-DD"
  endsAt: string;    // "YYYY-MM-DD"
  active: boolean;
  createdAt: string;
};

export type EffectivePrice = {
  originalPrice: number;
  finalPrice: number;
  /** Euros estalviats (sempre >= 0) */
  discountAmount: number;
  /** Text pel badge: "-15%" o "-10€" */
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
  service_type: string | null;
  service_id: string | null;
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
    serviceType: r.service_type as ServiceType | null,
    serviceId: r.service_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: r.active,
    createdAt: r.created_at,
  };
}

// ─── Càlcul de preu efectiu (funció pura, sense IO) ─────────────────────────

/** Calcula el millor preu aplicable per a un servei donada una llista de promocions. */
export function computeEffectivePrice(
  service: Service,
  promotions: Promotion[],
): EffectivePrice {
  const applicable = promotions.filter(
    (p) =>
      (p.scope === "package" && p.serviceId === service.id) ||
      (p.scope === "service" && p.serviceType === service.serviceType),
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

  // Escull la promoció que doni major estalvi
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

/** Retorna totes les promocions (per a l'admin). */
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

/** Retorna les promocions actives avui (per calcular preus). */
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

/** Retorna una promoció pel seu id. */
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
  serviceType: ServiceType | null;
  serviceId: string | null;
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
      service_type: input.serviceType,
      service_id: input.serviceId,
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
      service_type: input.serviceType,
      service_id: input.serviceId,
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
    if (input.serviceType !== undefined) p.service_type = input.serviceType;
    if (input.serviceId !== undefined) p.service_id = input.serviceId;
    if (input.startsAt !== undefined) p.starts_at = input.startsAt;
    if (input.endsAt !== undefined) p.ends_at = input.endsAt;
    if (input.active !== undefined) p.active = input.active;
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("promotions")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.discountType !== undefined && { discount_type: input.discountType }),
      ...(input.discountValue !== undefined && { discount_value: input.discountValue }),
      ...(input.scope !== undefined && { scope: input.scope }),
      ...(input.serviceType !== undefined && { service_type: input.serviceType }),
      ...(input.serviceId !== undefined && { service_id: input.serviceId }),
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

/**
 * Funció d'utilitat principal: donats uns serveis i la data d'avui,
 * retorna un Map serviceId → EffectivePrice.
 * Fa una sola consulta a la BD independentment del nombre de serveis.
 */
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

/**
 * Retorna el preu efectiu per a un sol servei (còmode per a createPendingBono).
 */
export async function getEffectivePrice(
  service: Service,
  today?: string,
): Promise<EffectivePrice> {
  const map = await getEffectivePrices([service], today);
  return map.get(service.id)!;
}

/**
 * Comprova si una nova oferta es solaparia amb alguna d'existent per al
 * mateix àmbit. Retorna true si hi ha solapament.
 */
export async function hasOverlap(input: {
  scope: PromotionScope;
  serviceType: ServiceType | null;
  serviceId: string | null;
  startsAt: string;
  endsAt: string;
  excludeId?: string;
}): Promise<boolean> {
  const all = await listPromotions();
  return all.some((p) => {
    if (input.excludeId && p.id === input.excludeId) return false;
    if (!p.active) return false;
    // Solapament de dates
    const datesOverlap = p.startsAt <= input.endsAt && p.endsAt >= input.startsAt;
    if (!datesOverlap) return false;
    // Solapament d'àmbit
    if (input.scope === "package" && p.scope === "package")
      return p.serviceId === input.serviceId;
    if (input.scope === "service" && p.scope === "service")
      return p.serviceType === input.serviceType;
    // Un scope='service' es solapa amb scope='package' del mateix tipus
    if (input.scope === "service" && p.scope === "package") return false;
    if (input.scope === "package" && p.scope === "service") return false;
    return false;
  });
}
