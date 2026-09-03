import "server-only";
import { centerToday } from "@/lib/center-time";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Service } from "@/lib/data/services";
import { formatEur } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import { listTagIdsForClient } from "@/lib/data/client-tags";
import type {
  DiscountType,
  PromotionAudience,
  PromotionScope,
  ServiceType,
} from "@/types/database";

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
  /** A qui arriba. 'all' = a tothom, com abans de la 0069. */
  audience: PromotionAudience;
  /** Etiqueta destinatària quan audience='tag'. Null en qualsevol altre cas. */
  audienceTagId: string | null;
  /** Tipus de servei del bo actiu que l'obre quan audience='active_bono'. */
  audienceServiceType: ServiceType | null;
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
  audience: PromotionAudience;
  audience_tag_id: string | null;
  audience_service_type: ServiceType | null;
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
    audience: r.audience,
    audienceTagId: r.audience_tag_id,
    audienceServiceType: r.audience_service_type,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: r.active,
    createdAt: r.created_at,
  };
}

// ─── Segmentació: a qui arriba una oferta (0069) ────────────────────────────

/**
 * El que cal saber d'un client per decidir quines ofertes l'abasten. Res més.
 *
 * Es resol UN COP per petició i viatja avall. Sense això, cada pantalla que
 * pinta un preu hauria de tornar a preguntar-ho, i tard o d'hora dues pantalles
 * respondrien coses diferents —que és exactament el que va passar amb
 * `discountLabel`.
 */
export type ClientAudience = {
  tagIds: Set<string>;
  activeBonoServiceTypes: Set<ServiceType>;
};

/**
 * ÚNIC lloc que resol el segment d'un client.
 *
 * Va per `service_role` a les dues meitats, i cada meitat per un motiu.
 *
 * Les ETIQUETES, per obligació: això corre a /client/bonos amb la sessió d'un
 * client, i un client no llegeix les seves etiquetes per disseny (0068) —sabria
 * com el classifica el centre. Amb la sessió, la consulta tornaria buida i el
 * descompte no s'aplicaria mai. El que en surt no diu res: uuid, no noms.
 *
 * Els BONS, per uniformitat: aquesta funció la criden l'admin, l'entrenador/a i
 * el propi client, i el segment d'una persona ha de sortir igual el pregunti
 * qui el pregunti. Amb la sessió, tres cridants amb tres RLS diferents podrien
 * donar tres preus per al mateix client.
 *
 * QUÈ COMPTA COM A BO ACTIU: `status = 'active'` i no caducat. NO
 * 'pending_payment', encara que `USABLE` a lib/data/bonos.ts sí que l'hi
 * compti. La raó viu a la 0069: aquí un bo no és informació, és una clau, i un
 * bo sense pagar no pot obrir un descompte —n'hi hauria prou amb encarregar-lo
 * i no pagar-lo.
 */
export async function getClientAudience(clientId: string): Promise<ClientAudience> {
  const today = centerToday();

  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const store = getStore();
    return {
      tagIds: new Set(await listTagIdsForClient(clientId)),
      activeBonoServiceTypes: new Set(
        store.bonos
          .filter(
            (b) =>
              b.client_id === clientId &&
              b.status === "active" &&
              (b.expires_at === null || b.expires_at >= today),
          )
          .map((b) => b.service_type),
      ),
    };
  }

  const admin = createAdminClient();
  const [tagIds, bonos] = await Promise.all([
    listTagIdsForClient(clientId),
    admin
      .from("bonos")
      .select("service_type")
      .eq("client_id", clientId)
      .eq("status", "active")
      // Mateixa condició que `isBonoExpired`, expressada a la consulta: sense
      // data no caduca, i amb data ha de ser d'avui o posterior.
      .or(`expires_at.is.null,expires_at.gte.${today}`),
  ]);
  if (bonos.error) throw bonos.error;

  return {
    tagIds: new Set(tagIds),
    activeBonoServiceTypes: new Set(
      (bonos.data ?? []).map((b) => b.service_type as ServiceType),
    ),
  };
}

/**
 * ÚNIC lloc que decideix si una oferta abasta algú. Pura, sense IO.
 *
 * `audience === null` vol dir "no hi ha ningú concret davant" —el catàleg de
 * l'admin, per exemple—: aleshores només valen les ofertes obertes a tothom.
 * Una oferta segmentada no és el preu del paquet, és el preu d'algú.
 */
function reachesAudience(p: Promotion, audience: ClientAudience | null): boolean {
  if (p.audience === "all") return true;
  if (!audience) return false;
  if (p.audience === "tag")
    return p.audienceTagId !== null && audience.tagIds.has(p.audienceTagId);
  return (
    p.audienceServiceType !== null &&
    audience.activeBonoServiceTypes.has(p.audienceServiceType)
  );
}

/** Si el descompte cau sobre aquest paquet, deixant de banda a qui va dirigit. */
function matchesScope(p: Promotion, service: Service): boolean {
  return (
    (p.scope === "package" && p.serviceIds.includes(service.id)) ||
    (p.scope === "service" && p.serviceTypes.includes(service.serviceType))
  );
}

/**
 * L'etiqueta d'un descompte ("-15%", "-10,00 €"), en un sol lloc.
 *
 * Existeix perquè n'hi havia dues. La d'aquí sota, correcta, i una còpia a
 * /admin/ofertes que la construïa amb `-${formatEur(valor)}`: el mateix error
 * que el comentari de `computeEffectivePrice` ja donava per resolt. Només es
 * veia en anglès, i l'admin va en català, així que no la veia ningú. Ara les
 * dues pantalles criden aquesta.
 */
export function formatDiscountLabel(
  discountType: DiscountType,
  discountValue: number,
  locale?: Locale,
): string {
  // El valor va en NEGATIU perquè el signe el col·loqui `Intl` i no nosaltres:
  // on va el menys respecte del símbol també depèn de l'idioma.
  return discountType === "percentage"
    ? `-${discountValue}%`
    : formatEur(-discountValue, locale);
}

// ─── Càlcul de preu efectiu (funció pura, sense IO) ─────────────────────────

/**
 * Preu efectiu d'un paquet un cop aplicada la millor oferta.
 *
 * `locale` és opcional i cau al català, com totes les funcions de format de
 * `lib/labels.ts`: així les crides de l'admin no canvien ni una línia i les
 * pantalles del client hi passen el seu.
 *
 * L'import del descompte es formata amb `formatEur` i no a mà. Abans es
 * construïa amb `-${valor}€`, i això donava "-10€" a tothom: sense decimals,
 * amb el símbol enganxat i sempre a la dreta. En anglès l'euro va davant
 * (-€10.00), de manera que el client anglès veia una etiqueta amb el format
 * català al costat d'un preu amb el format anglès. La mateixa oferta es llegia
 * "-10€" al client i "-10,00 €" a l'admin, que sí que feia servir `formatEur`.
 *
 * Es passa el valor en NEGATIU perquè el signe el col·loqui `Intl` i no
 * nosaltres: on va el menys respecte del símbol també depèn de l'idioma.
 */
export function computeEffectivePrice(
  service: Service,
  promotions: Promotion[],
  opts: { locale?: Locale; audience?: ClientAudience | null } = {},
): EffectivePrice {
  const { locale, audience = null } = opts;

  // Dos filtres i no un: QUÈ rebaixa l'oferta i A QUI arriba. La regla de
  // "guanya la millor" de sota no canvia gens —només canvia què hi entra.
  const applicable = promotions.filter(
    (p) => matchesScope(p, service) && reachesAudience(p, audience),
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
  const discountLabel = formatDiscountLabel(
    bestPromo.discountType,
    bestPromo.discountValue,
    locale,
  );

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
  audience: PromotionAudience;
  /** Només quan audience='tag'. La Server Action ja el valida. */
  audienceTagId: string | null;
  /** Només quan audience='active_bono'. */
  audienceServiceType: ServiceType | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

/**
 * Les tres columnes d'audiència a partir de l'input, netes.
 *
 * En un sol lloc perquè el constraint `promotions_audience_check` (0069) exigeix
 * que les altres dues siguin NULL, i escriure-ho a mà a l'insert i a l'update
 * és com es cola una fila que diu dues coses alhora.
 */
function audienceColumns(input: {
  audience: PromotionAudience;
  audienceTagId: string | null;
  audienceServiceType: ServiceType | null;
}) {
  return {
    audience: input.audience,
    audience_tag_id: input.audience === "tag" ? input.audienceTagId : null,
    audience_service_type:
      input.audience === "active_bono" ? input.audienceServiceType : null,
  };
}

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
      ...audienceColumns(input),
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
      ...audienceColumns(input),
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
    if (input.audience !== undefined) {
      const cols = audienceColumns({
        audience: input.audience,
        audienceTagId: input.audienceTagId ?? null,
        audienceServiceType: input.audienceServiceType ?? null,
      });
      p.audience = cols.audience;
      p.audience_tag_id = cols.audience_tag_id;
      p.audience_service_type = cols.audience_service_type;
    }
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
      // Les tres columnes viatgen juntes o no viatgen: `toggleOfertaAction` només
      // passa `active` i no ha de tocar l'audiència, però qui passa `audience` ha
      // d'escriure també els dos camps que el constraint exigeix nuls.
      ...(input.audience !== undefined &&
        audienceColumns({
          audience: input.audience,
          audienceTagId: input.audienceTagId ?? null,
          audienceServiceType: input.audienceServiceType ?? null,
        })),
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
 * Per a qui es calcula el preu, i com es formata.
 *
 * És un objecte i no tres paràmetres posicionals a posta. `clientId` decideix
 * si les ofertes segmentades hi entren o no, i aquesta és una decisió que cada
 * pantalla ha de PRENDRE, no heretar per descuit. En forma d'objecte, qui llegeix
 * la crida veu de seguida si hi ha algú concret al davant; en forma de quart
 * argument opcional, oblidar-se'l no es notaria enlloc.
 *
 * Sense `clientId` només s'apliquen les ofertes obertes a tothom. És el que
 * volem al catàleg de l'admin: una oferta segmentada no és el preu del paquet.
 */
export type EffectivePriceOptions = {
  /** Dia del centre a considerar. Per defecte, avui. */
  today?: string;
  /** Idioma de qui llegeix, per a l'etiqueta del descompte. Per defecte, català. */
  locale?: Locale;
  /** Client per al qual es calcula. Sense ell, només ofertes per a tothom. */
  clientId?: string;
};

export async function getEffectivePrices(
  services: Service[],
  opts: EffectivePriceOptions = {},
): Promise<Map<string, EffectivePrice>> {
  // Dia del centre: una oferta que comença avui ha de valer des de la
  // mitjanit d'aquí, no des de les 02:00 (que és quan el dia canvia en UTC).
  const todayStr = opts.today ?? centerToday();

  // El segment es resol UN COP per a tot el catàleg, no un cop per paquet.
  const [promotions, audience] = await Promise.all([
    listActivePromotions(todayStr),
    opts.clientId ? getClientAudience(opts.clientId) : Promise.resolve(null),
  ]);

  const result = new Map<string, EffectivePrice>();
  for (const s of services) {
    result.set(s.id, computeEffectivePrice(s, promotions, { locale: opts.locale, audience }));
  }
  return result;
}

export async function getEffectivePrice(
  service: Service,
  opts: EffectivePriceOptions = {},
): Promise<EffectivePrice> {
  const map = await getEffectivePrices([service], opts);
  return map.get(service.id)!;
}

/**
 * Si dues ofertes van prou al mateix públic com perquè coincidir sigui sospitós.
 *
 * ATENCIÓ, que això és una HEURÍSTICA i no una veritat lògica. Estrictament,
 * dos segments qualssevol poden caure sobre la mateixa persona: un client pot
 * portar l'etiqueta VIP i l'etiqueta Empresa alhora, o portar la VIP i a més
 * tenir un bo actiu de fisioteràpia. Si l'avís volgués ser exacte, saltaria
 * SEMPRE.
 *
 * I saltar sempre és el que el fa inútil. L'avís existeix per enxampar
 * despistes —dues ofertes generals sobre el mateix servei, que gairebé sempre
 * vol dir que algú n'ha creat una segona sense recordar la primera—, no per
 * informar que la segmentació funciona. Una oferta VIP al costat de la general
 * és el cas NORMAL, i avisar-ne cada vegada ensenyaria l'admin a ignorar
 * l'avís, que és pitjor que no tenir-lo.
 *
 * Quan dos segments diferents sí que cauen sobre la mateixa persona, no passa
 * res: la regla de "guanya la millor oferta" ho resol sola i de manera
 * determinista. No és un conflicte, és el disseny.
 */
function audiencesLookLikeAClash(
  a: { audience: PromotionAudience; audienceTagId: string | null; audienceServiceType: ServiceType | null },
  b: Promotion,
): boolean {
  if (a.audience === "all" || b.audience === "all") return true;
  if (a.audience !== b.audience) return false;
  if (a.audience === "tag") return a.audienceTagId === b.audienceTagId;
  return a.audienceServiceType === b.audienceServiceType;
}

/**
 * Comprova si una nova oferta es solaparia amb alguna d'existent.
 * Dues promocions es solapen si comparteixen dates, almenys un service_type
 * o service_id en comú (intersecció d'arrays) I un públic que xoca.
 */
export async function hasOverlap(input: {
  scope: PromotionScope;
  serviceTypes: ServiceType[];
  serviceIds: string[];
  audience: PromotionAudience;
  audienceTagId: string | null;
  audienceServiceType: ServiceType | null;
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
    if (!audiencesLookLikeAClash(input, p)) return false;
    if (input.scope === "package" && p.scope === "package")
      return input.serviceIds.some((id) => p.serviceIds.includes(id));
    if (input.scope === "service" && p.scope === "service")
      return input.serviceTypes.some((t) => p.serviceTypes.includes(t));
    return false;
  });
}
