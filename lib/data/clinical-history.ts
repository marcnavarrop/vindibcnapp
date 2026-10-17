import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import { isDemoClient } from "@/lib/demo-accounts";
import { logDataAccess } from "@/lib/data/data-access-log";
import {
  canReadClinical,
  CLINICAL_MAX,
  type ClinicalSubject,
  type ClinicalViewer,
} from "@/lib/clinical-access";

/**
 * L'HISTORIAL CLÍNIC D'UN CLIENT (0110): «Primera visita» i «Seguiment».
 *
 * Tot es llegeix i s'escriu amb la sessió de qui mira: qui hi arriba ho decideix
 * la RLS de la 0110, i `lib/clinical-access.ts` en diu el mateix a la pantalla.
 * Aquí no es comprova cap permís: ho fan les accions, i ho torna a fer la base.
 *
 * Al mock no hi ha RLS: s'hi aplica la regla pura, perquè la simulació no deixi
 * veure el que producció amagaria.
 */

export type ClinicalFirstVisit = {
  body: string;
  createdByName: string | null;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string;
};

export type ClinicalFollowup = {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicalHistory = {
  firstVisit: ClinicalFirstVisit | null;
  /** Del més nou al més antic. */
  followups: ClinicalFollowup[];
};

/** Prou per a anys d'un client; si mai s'hi arriba, es diu a la pantalla. */
export const FOLLOWUPS_LIMIT = 200;

type Viewer = ClinicalViewer;

/** Noms dels perfils que ha escrit alguna cosa (els que qui mira pot veure). */
async function namesOf(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  if (USE_MOCK) {
    for (const p of getStore().profiles)
      if (unique.includes(p.id)) out.set(p.id, p.full_name ?? "—");
    return out;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique)
    .limit(unique.length);
  for (const p of data ?? []) out.set(p.id, p.full_name ?? "—");
  return out;
}

export async function getClinicalHistory(
  client: ClinicalSubject,
  viewer: Viewer,
): Promise<ClinicalHistory> {
  let first: {
    body: string;
    created_by: string | null;
    created_at: string;
    updated_by: string | null;
    updated_at: string;
  } | null = null;
  let follows: {
    id: string;
    body: string;
    author_id: string | null;
    created_at: string;
    updated_at: string;
  }[] = [];

  if (USE_MOCK) {
    if (!canReadClinical(viewer, client)) return { firstVisit: null, followups: [] };
    const s = getStore();
    first = s.clinical_first_visits.find((f) => f.client_id === client.id) ?? null;
    follows = s.clinical_followups
      .filter((f) => f.client_id === client.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, FOLLOWUPS_LIMIT);
  } else {
    const supabase = await createClient();
    const [fv, fu] = await Promise.all([
      supabase
        .from("clinical_first_visits")
        .select("body, created_by, created_at, updated_by, updated_at")
        .eq("client_id", client.id)
        .maybeSingle(),
      supabase
        .from("clinical_followups")
        .select("id, body, author_id, created_at, updated_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(FOLLOWUPS_LIMIT),
    ]);
    if (fv.error) throw fv.error;
    if (fu.error) throw fu.error;
    first = fv.data;
    follows = fu.data ?? [];
  }

  const names = await namesOf([
    first?.created_by ?? null,
    first?.updated_by ?? null,
    ...follows.map((f) => f.author_id),
  ]);
  return {
    firstVisit: first
      ? {
          body: first.body,
          createdByName: first.created_by ? (names.get(first.created_by) ?? null) : null,
          createdAt: first.created_at,
          updatedByName: first.updated_by ? (names.get(first.updated_by) ?? null) : null,
          updatedAt: first.updated_at,
        }
      : null,
    followups: follows.map((f) => ({
      id: f.id,
      body: f.body,
      authorId: f.author_id,
      authorName: f.author_id ? (names.get(f.author_id) ?? null) : null,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    })),
  };
}

/**
 * Si ha signat el consentiment de dades de salut, i quan. Amb la funció de la
 * 0110, que només ho diu a qui pot llegir l'historial; a qualsevol altre, null.
 */
export async function getHealthConsentFor(
  client: ClinicalSubject & { profileId: string },
  viewer: Viewer,
): Promise<{ grantedAt: string; version: string } | null> {
  if (USE_MOCK) {
    if (!canReadClinical(viewer, client)) return null;
    const c = getStore()
      .consents.filter((x) => x.user_id === client.profileId && x.type === "health_data" && !x.revoked_at)
      .sort((a, b) => b.granted_at.localeCompare(a.granted_at))[0];
    return c ? { grantedAt: c.granted_at, version: c.version } : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("health_consent_status", { p_client: client.id });
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? { grantedAt: row.granted_at, version: row.version } : null;
}

function cleanBody(raw: string): string {
  const body = raw.trim();
  if (!body) throw new Error("Escriu alguna cosa.");
  if (body.length > CLINICAL_MAX)
    throw new Error(`El text no pot passar de ${CLINICAL_MAX} caràcters.`);
  return body;
}

/** Crea o edita la primera visita. Qui l'edita, i quan, ho posa la base. */
export async function saveFirstVisit(clientId: string, raw: string, viewerId: string): Promise<void> {
  const body = cleanBody(raw);
  if (USE_MOCK) {
    const s = getStore();
    const now = new Date().toISOString();
    const f = s.clinical_first_visits.find((x) => x.client_id === clientId);
    if (f) {
      f.body = body;
      f.updated_by = viewerId;
      f.updated_at = now;
    } else {
      s.clinical_first_visits.push({ client_id: clientId, body, created_by: viewerId, created_at: now, updated_by: viewerId, updated_at: now });
    }
    saveStore(s);
    return;
  }
  const supabase = await createClient();
  const { data: existing, error: rErr } = await supabase
    .from("clinical_first_visits")
    .select("client_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (existing) {
    const { data, error } = await supabase
      .from("clinical_first_visits")
      .update({ body })
      .eq("client_id", clientId)
      .select("client_id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No pots editar la primera visita d'aquest client.");
  } else {
    const { error } = await supabase
      .from("clinical_first_visits")
      .insert({ client_id: clientId, body, created_by: viewerId });
    if (error) throw error;
  }
}

export async function addFollowup(clientId: string, raw: string, viewerId: string): Promise<void> {
  const body = cleanBody(raw);
  if (USE_MOCK) {
    const s = getStore();
    const now = new Date().toISOString();
    s.clinical_followups.push({ id: crypto.randomUUID(), client_id: clientId, author_id: viewerId, body, created_at: now, updated_at: now });
    saveStore(s);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("clinical_followups")
    .insert({ client_id: clientId, author_id: viewerId, body });
  if (error) throw error;
}

/** Un seguiment: el client i l'autor, per decidir qui el pot tocar. */
export async function getFollowupMeta(
  id: string,
): Promise<{ clientId: string; authorId: string | null } | null> {
  if (USE_MOCK) {
    const f = getStore().clinical_followups.find((x) => x.id === id);
    return f ? { clientId: f.client_id, authorId: f.author_id } : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_followups")
    .select("client_id, author_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? { clientId: data.client_id, authorId: data.author_id } : null;
}

export async function editFollowup(id: string, raw: string): Promise<void> {
  const body = cleanBody(raw);
  if (USE_MOCK) {
    const s = getStore();
    const f = s.clinical_followups.find((x) => x.id === id);
    if (!f) throw new Error("Aquest seguiment ja no existeix.");
    f.body = body;
    f.updated_at = new Date().toISOString();
    saveStore(s);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_followups")
    .update({ body })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Aquest seguiment no el pots editar.");
}

export async function deleteFollowup(id: string): Promise<void> {
  if (USE_MOCK) {
    const s = getStore();
    s.clinical_followups = s.clinical_followups.filter((x) => x.id !== id);
    saveStore(s);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("clinical_followups").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Aquest seguiment no el pots esborrar.");
}

/** Qui mira ja ha vist l'historial d'aquest client fins ara. */
export async function markClinicalSeen(clientId: string, viewerId: string): Promise<void> {
  const now = new Date().toISOString();
  if (USE_MOCK) {
    const s = getStore();
    const row = s.clinical_seen.find((x) => x.viewer_id === viewerId && x.client_id === clientId);
    if (row) row.seen_at = now;
    else s.clinical_seen.push({ viewer_id: viewerId, client_id: clientId, seen_at: now });
    saveStore(s);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("clinical_seen")
    .upsert({ viewer_id: viewerId, client_id: clientId, seen_at: now }, { onConflict: "viewer_id,client_id" });
  if (error) throw error;
}

/**
 * Una fila al registre d'accessos (0110) cada cop que algú que NO és admin
 * obre un historial. El del Client Demo no s'hi registra (decisió d'en Marc):
 * el registre és la prova de compliment i no s'ha d'omplir amb proves.
 */
export async function logClinicalView(input: {
  viewer: Viewer;
  clientId: string;
  clientProfileId: string;
  clientName: string;
}): Promise<void> {
  if (input.viewer.role === "admin") return;
  if (isDemoClient(input.clientId)) return;
  await logDataAccess({
    actorId: input.viewer.id,
    subjectProfileId: input.clientProfileId,
    subjectLabel: input.clientName,
    action: "clinical_view",
    details: "Historial clínic obert a la fitxa",
  });
}

/** El darrer canvi fet per algú que NO és qui mira. */
type Change = { clientId: string; at: string; by: string | null };

function changesOf(
  first: { client_id: string; updated_at: string; updated_by: string | null }[],
  follows: { client_id: string; author_id: string | null; created_at: string; updated_at: string }[],
): Change[] {
  return [
    ...first.map((f) => ({ clientId: f.client_id, at: f.updated_at, by: f.updated_by })),
    ...follows.map((f) => ({ clientId: f.client_id, at: f.updated_at > f.created_at ? f.updated_at : f.created_at, by: f.author_id })),
  ];
}

/**
 * Els clients amb NOVETAT a l'historial per a aquest professional: hi ha una
 * entrada nova o una primera visita editada per un altre, posterior a l'última
 * vegada que ell el va obrir (o que no l'ha obert mai). Només els seus clients
 * assignats: és l'avís per a l'entrenador del client.
 */
export async function clientsWithClinicalNovelty(
  trainerId: string,
  onlyClientId?: string,
): Promise<string[]> {
  let clientIds: string[];
  let first: { client_id: string; updated_at: string; updated_by: string | null }[];
  let follows: { client_id: string; author_id: string | null; created_at: string; updated_at: string }[];
  let seen: Map<string, string>;

  if (USE_MOCK) {
    const s = getStore();
    clientIds = s.clients
      .filter((c) => c.assigned_trainer_id === trainerId && (!onlyClientId || c.id === onlyClientId))
      .map((c) => c.id);
    first = s.clinical_first_visits.filter((f) => clientIds.includes(f.client_id));
    follows = s.clinical_followups.filter((f) => clientIds.includes(f.client_id));
    seen = new Map(s.clinical_seen.filter((x) => x.viewer_id === trainerId).map((x) => [x.client_id, x.seen_at]));
  } else {
    const supabase = await createClient();
    let q = supabase.from("clients").select("id").eq("assigned_trainer_id", trainerId).limit(500);
    if (onlyClientId) q = q.eq("id", onlyClientId);
    const { data: cl, error } = await q;
    if (error) throw error;
    clientIds = (cl ?? []).map((c) => c.id);
    if (clientIds.length === 0) return [];
    const [fv, fu, sn] = await Promise.all([
      supabase.from("clinical_first_visits").select("client_id, updated_at, updated_by").in("client_id", clientIds).limit(500),
      supabase
        .from("clinical_followups")
        .select("client_id, author_id, created_at, updated_at")
        .in("client_id", clientIds)
        .order("updated_at", { ascending: false })
        .limit(1000),
      supabase.from("clinical_seen").select("client_id, seen_at").eq("viewer_id", trainerId).limit(500),
    ]);
    if (fv.error) throw fv.error;
    if (fu.error) throw fu.error;
    if (sn.error) throw sn.error;
    first = fv.data ?? [];
    follows = fu.data ?? [];
    seen = new Map((sn.data ?? []).map((x) => [x.client_id, x.seen_at]));
  }

  const out = new Set<string>();
  for (const ch of changesOf(first, follows)) {
    if (ch.by === trainerId) continue;
    const s = seen.get(ch.clientId);
    if (!s || ch.at > s) out.add(ch.clientId);
  }
  return [...out];
}
