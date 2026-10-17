import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore, type Store } from "@/lib/mock/store";
import { isDemoClient, isDemoTrainer, type DemoWorld } from "@/lib/demo-accounts";
import { getDemoWorld } from "@/lib/data/demo-world";
import { centerDateStr } from "@/lib/center-time";
import { logDataAccess } from "@/lib/data/data-access-log";
import { mockFails } from "@/lib/mock/faults";
import type { ClinicalViewer } from "@/lib/clinical-access";
import type { ClinicalArchiveKind, Database } from "@/types/database";

/**
 * L'ARXIU CLÍNIC (0119): el que es conserva de l'historial de fisioteràpia
 * quan un client es dona de baixa (Llei 21/2000, art. 12).
 *
 *   · ESCRIURE-HI només ho fa la base: `archive_clinical_history` (en la baixa)
 *     i `purge_clinical_archive` (el cron), amb la clau de servei i després que
 *     l'app hagi comprovat el rol. Per l'API, ningú no hi té permís.
 *   · LLEGIR-LO es fa amb la sessió de qui mira: la RLS deixa l'admin (tot) i
 *     els fisios (demo amb demo). Els fitxers són al bucket privat
 *     `clinical-archive`, sense cap política: l'URL signada la dona l'app NOMÉS
 *     si qui la demana ha pogut llegir la fila amb la seva sessió.
 *   · Cada consulta i cada exportació queden a `data_access_log`.
 *
 * Al mock no hi ha RLS ni bucket: s'hi aplica la mateixa regla a mà i els
 * documents són només metadades.
 */

const SOURCE_BUCKET = "client-documents";
const ARCHIVE_BUCKET = "clinical-archive";
/** Les URL signades dels documents arxivats, 10 minuts: es fan servir de seguida. */
const SIGNED_URL_TTL = 600;

type PatientRow = Database["public"]["Tables"]["clinical_archive_patients"]["Row"];
type EntryRow = Database["public"]["Tables"]["clinical_archive_entries"]["Row"];

export type ClinicalRetention = {
  hasHistory: boolean;
  isDemo: boolean;
  /** L'«alta»: l'última atenció de fisioteràpia (o l'última entrada clínica). */
  lastCareOn: string | null;
  /** Fins quan es conservaria, si s'arxivés avui (`YYYY-MM-DD`). */
  purgeAfter: string | null;
};

export type ArchiveOutcome =
  | { archived: false }
  | { archived: true; patientId: string; purgeAfter: string; isDemo: boolean; already?: boolean };

export type ArchivedPatientSummary = {
  id: string;
  fullName: string;
  birthDate: string | null;
  lastCareOn: string;
  archivedAt: string;
  isDemo: boolean;
  /** La primera data en què alguna entrada vencerà. */
  purgeAfter: string | null;
  entries: number;
};

export type ArchivedEntry = {
  id: string;
  kind: ClinicalArchiveKind;
  body: string | null;
  authorName: string | null;
  writtenAt: string;
  updatedAt: string | null;
  sessionOn: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  description: string | null;
  consentVersion: string | null;
  consentRevokedAt: string | null;
  purgeAfter: string;
};

export type ArchivedPatient = ArchivedPatientSummary & {
  email: string | null;
  phone: string | null;
  archivedByName: string | null;
  entryList: ArchivedEntry[];
};

/** Admin o fisioterapeuta. La regla fina (demo amb demo) la fa la RLS. */
export function canReadClinicalArchive(v: ClinicalViewer | null): boolean {
  return !!v && (v.role === "admin" || (v.role === "trainer" && v.specialty === "fisioterapeuta"));
}

// ─── Fins quan es conservaria ────────────────────────────────────────────────

/** Clau de servei: només des de la baixa, després de comprovar que és l'admin. */
export async function getClinicalRetention(clientId: string): Promise<ClinicalRetention | null> {
  if (USE_MOCK) return mockRetention(getStore(), clientId, await getDemoWorld());
  const { data, error } = await createAdminClient().rpc("clinical_retention_for", { p_client: clientId });
  if (error) throw new Error(`No s'ha pogut consultar l'historial clínic: ${error.message}`);
  const r = data?.[0];
  if (!r || r.has_history === null) return null;
  return {
    hasHistory: !!r.has_history,
    isDemo: !!r.is_demo,
    lastCareOn: r.last_care_on,
    purgeAfter: r.purge_after,
  };
}

// ─── Arxivar (dins de la baixa) ──────────────────────────────────────────────

/**
 * Arxiva l'historial clínic d'un client ABANS d'esborrar-li el compte. Si no en
 * té, no fa res. Si alguna cosa falla, llença i no deixa res a mitges (ni
 * files, ni fitxers copiats): qui crida NO ha d'esborrar el compte.
 *
 * Si el client ja té un arxiu (una baixa anterior que va arxivar i després va
 * fallar en esborrar el compte), no se'n fa un altre: els documents d'origen ja
 * no hi serien i el que hi ha és el bo. Es continua amb la baixa.
 */
export async function archiveClinicalHistory(clientId: string, actorId: string): Promise<ArchiveOutcome> {
  if (USE_MOCK) return mockArchive(clientId, actorId, await getDemoWorld());

  const retention = await getClinicalRetention(clientId);
  if (!retention) throw new Error("Client no trobat.");
  if (!retention.hasHistory) return { archived: false };

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("clinical_archive_patients")
    .select("id, is_demo")
    .eq("former_client_id", clientId)
    .maybeSingle();
  if (existingError) throw new Error(`No s'ha pogut consultar l'arxiu clínic: ${existingError.message}`);
  if (existing) {
    const { data: first } = await admin
      .from("clinical_archive_entries")
      .select("purge_after")
      .eq("patient_id", existing.id)
      .order("purge_after")
      .limit(1);
    return {
      archived: true,
      already: true,
      patientId: existing.id,
      isDemo: existing.is_demo,
      purgeAfter: first?.[0]?.purge_after ?? retention.purgeAfter ?? "",
    };
  }

  const patientId = crypto.randomUUID();
  const { data: docs, error: docsError } = await admin
    .from("client_documents")
    .select("id, storage_path, file_name, file_size, mime_type, description, uploaded_at")
    .eq("client_id", clientId)
    // Els d'un sol client: si mai n'hi hagués més, l'arxivat s'atura (no en perd cap en silenci).
    .limit(1001);
  if (docsError) throw new Error(`No s'han pogut llegir els documents: ${docsError.message}`);
  if ((docs?.length ?? 0) > 1000)
    throw new Error("Aquest client té més de 1.000 documents: no es pot arxivar d'un cop. No s'ha esborrat res.");

  // 1. Els fitxers, copiats al bucket de l'arxiu (no es mouen: si l'arxivat
  //    falla, l'original s'ha de quedar on era).
  const copied: string[] = [];
  const undo = async () => {
    if (copied.length) await admin.storage.from(ARCHIVE_BUCKET).remove(copied);
  };
  const documents = [];
  for (const d of docs ?? []) {
    const target = `${patientId}/${d.storage_path.split("/").pop()}`;
    const { error } = await admin.storage
      .from(SOURCE_BUCKET)
      .copy(d.storage_path, target, { destinationBucket: ARCHIVE_BUCKET });
    if (error) {
      await undo();
      throw new Error(`No s'ha pogut arxivar el document «${d.file_name}»: ${error.message}. No s'ha esborrat res.`);
    }
    copied.push(target);
    documents.push({
      source_id: d.id,
      storage_path: target,
      file_name: d.file_name,
      file_size: d.file_size,
      mime_type: d.mime_type,
      description: d.description,
      uploaded_at: d.uploaded_at,
    });
  }

  // 2. Les files, tot o res, a la base.
  const { data, error } = await admin.rpc("archive_clinical_history", {
    p_client: clientId,
    p_patient_id: patientId,
    p_documents: documents,
    p_actor: actorId,
  });
  if (error) {
    await undo();
    throw new Error(`No s'ha pogut arxivar l'historial clínic: ${error.message}. No s'ha esborrat res.`);
  }
  const out = (data ?? {}) as { archived?: boolean; purge_after?: string; is_demo?: boolean };
  if (!out.archived) {
    await undo();
    return { archived: false };
  }
  return { archived: true, patientId, purgeAfter: out.purge_after ?? "", isDemo: !!out.is_demo };
}

// ─── Llegir (amb la sessió de qui mira) ──────────────────────────────────────

export async function listArchivedPatients(viewer: ClinicalViewer): Promise<ArchivedPatientSummary[]> {
  if (!canReadClinicalArchive(viewer)) return [];
  let patients: PatientRow[];
  let entries: Pick<EntryRow, "patient_id" | "purge_after">[];
  if (USE_MOCK) {
    const store = getStore();
    const world = await getDemoWorld();
    patients = store.clinical_archive_patients.filter((p) => mockCanSee(viewer, p, world));
    const ids = new Set(patients.map((p) => p.id));
    entries = store.clinical_archive_entries.filter((e) => ids.has(e.patient_id));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clinical_archive_patients")
      .select("*")
      .order("archived_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    patients = data ?? [];
    if (patients.length) {
      const { data: e, error: eError } = await supabase
        .from("clinical_archive_entries")
        .select("patient_id, purge_after")
        .in("patient_id", patients.map((p) => p.id))
        .limit(50000);
      if (eError) throw new Error(eError.message);
      entries = e ?? [];
    } else entries = [];
  }
  return patients
    .map((p) => summaryOf(p, entries.filter((e) => e.patient_id === p.id)))
    .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

/**
 * La fitxa sencera d'un pacient arxivat, i en deixa constància
 * (`clinical_archive_view`, o `clinical_archive_export` si és per exportar).
 */
export async function getArchivedPatient(
  id: string,
  viewer: ClinicalViewer,
  purpose: "view" | "export" = "view",
): Promise<ArchivedPatient | null> {
  if (!canReadClinicalArchive(viewer)) return null;
  let patient: PatientRow | null;
  let entries: EntryRow[];
  if (USE_MOCK) {
    const store = getStore();
    const world = await getDemoWorld();
    patient = store.clinical_archive_patients.find((p) => p.id === id && mockCanSee(viewer, p, world)) ?? null;
    entries = patient ? store.clinical_archive_entries.filter((e) => e.patient_id === id) : [];
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.from("clinical_archive_patients").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    patient = data;
    if (patient) {
      const { data: e, error: eError } = await supabase
        .from("clinical_archive_entries")
        .select("*")
        .eq("patient_id", id)
        .order("written_at", { ascending: false })
        .limit(5000);
      if (eError) throw new Error(eError.message);
      entries = e ?? [];
    } else entries = [];
  }
  if (!patient) return null;

  await logDataAccess({
    actorId: viewer.id,
    subjectProfileId: null,
    subjectLabel: `${patient.full_name} (arxiu clínic ${patient.id})`,
    action: purpose === "export" ? "clinical_archive_export" : "clinical_archive_view",
    details: purpose === "export" ? "Exportació de l'arxiu clínic." : "Consulta de l'arxiu clínic.",
  }).catch(() => {
    // El registre és best-effort, com a la resta de l'RGPD: no tanca la consulta.
  });

  return {
    ...summaryOf(patient, entries),
    email: patient.email,
    phone: patient.phone,
    archivedByName: patient.archived_by_name,
    entryList: entries
      .map(entryOf)
      .sort((a, b) => b.writtenAt.localeCompare(a.writtenAt)),
  };
}

/**
 * L'URL signada d'un document arxivat. Primer es llegeix la fila amb la sessió
 * de qui ho demana: si la RLS no l'hi deixa veure, no hi ha URL.
 */
export async function getArchivedDocumentUrl(entryId: string, viewer: ClinicalViewer): Promise<string | null> {
  if (!canReadClinicalArchive(viewer)) return null;
  if (USE_MOCK) {
    const store = getStore();
    const e = store.clinical_archive_entries.find((x) => x.id === entryId && x.kind === "document");
    const p = e && store.clinical_archive_patients.find((x) => x.id === e.patient_id);
    if (!e || !p || !mockCanSee(viewer, p, await getDemoWorld())) return null;
    return `data:text/plain;charset=utf-8,${encodeURIComponent("[Document arxivat (simulació): " + (e.file_name ?? "") + "]")}`;
  }
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("clinical_archive_entries")
    .select("storage_path")
    .eq("id", entryId)
    .eq("kind", "document")
    .maybeSingle();
  if (!e?.storage_path) return null;
  const { data, error } = await createAdminClient()
    .storage.from(ARCHIVE_BUCKET)
    .createSignedUrl(e.storage_path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// ─── Purga (el cron) ─────────────────────────────────────────────────────────

export type PurgeOutcome = { expired: number; purged: number; filesRemoved: number; filesFailed: number };

/**
 * Esborra el que ha vençut: primer els fitxers del bucket (per l'API de
 * Storage) i després les files. Una entrada amb fitxer que no s'ha pogut
 * esborrar NO es purga avui (si no, el fitxer quedaria orfe per sempre): ho
 * tornarà a provar demà.
 */
export async function purgeExpiredClinicalArchive(today: string): Promise<PurgeOutcome> {
  if (USE_MOCK) return mockPurge(today);
  const admin = createAdminClient();
  const { data: expired, error } = await admin.rpc("clinical_archive_expired", { p_today: today });
  if (error) throw new Error(error.message);
  const rows = expired ?? [];
  if (!rows.length) return { expired: 0, purged: 0, filesRemoved: 0, filesFailed: 0 };

  const ok: string[] = rows.filter((r) => !r.storage_path).map((r) => r.entry_id);
  let filesRemoved = 0;
  let filesFailed = 0;
  const withFile = rows.filter((r) => !!r.storage_path);
  for (let i = 0; i < withFile.length; i += 100) {
    const batch = withFile.slice(i, i + 100);
    const { error: rmError } = await admin.storage.from(ARCHIVE_BUCKET).remove(batch.map((r) => r.storage_path!));
    if (rmError) {
      console.error("[clinical-archive] no s'han pogut esborrar fitxers vençuts", rmError.message);
      filesFailed += batch.length;
      continue;
    }
    filesRemoved += batch.length;
    ok.push(...batch.map((r) => r.entry_id));
  }
  if (!ok.length) return { expired: rows.length, purged: 0, filesRemoved, filesFailed };
  const { data: n, error: pError } = await admin.rpc("purge_clinical_archive", { p_entry_ids: ok, p_today: today });
  if (pError) throw new Error(pError.message);
  return { expired: rows.length, purged: n ?? 0, filesRemoved, filesFailed };
}

// ─── Ajudes ──────────────────────────────────────────────────────────────────

function summaryOf(p: PatientRow, entries: Pick<EntryRow, "purge_after">[]): ArchivedPatientSummary {
  const dates = entries.map((e) => e.purge_after).sort();
  return {
    id: p.id,
    fullName: p.full_name,
    birthDate: p.birth_date,
    lastCareOn: p.last_care_on,
    archivedAt: p.archived_at,
    isDemo: p.is_demo,
    purgeAfter: dates[0] ?? null,
    entries: entries.length,
  };
}

function entryOf(e: EntryRow): ArchivedEntry {
  return {
    id: e.id,
    kind: e.kind,
    body: e.body,
    authorName: e.author_name,
    writtenAt: e.written_at,
    updatedAt: e.updated_at,
    sessionOn: e.session_on,
    fileName: e.file_name,
    fileSize: e.file_size,
    mimeType: e.mime_type,
    description: e.description,
    consentVersion: e.consent_version,
    consentRevokedAt: e.consent_revoked_at,
    purgeAfter: e.purge_after,
  };
}

// ─── Simulació: la mateixa regla que la base ─────────────────────────────────

/** La RLS de la 0119: l'admin, tot; un fisio, només el seu món (demo o real). */
function mockCanSee(v: ClinicalViewer, p: PatientRow, world: DemoWorld): boolean {
  if (v.role === "admin") return true;
  return v.role === "trainer" && v.specialty === "fisioterapeuta" && p.is_demo === isDemoTrainer(world, v.id);
}

const plus15 = (day: string) => `${Number(day.slice(0, 4)) + 15}${day.slice(4)}`;

/** `clinical_retention_for`, en simulació. */
function mockRetention(store: Store, clientId: string, world: DemoWorld): ClinicalRetention | null {
  const client = store.clients.find((c) => c.id === clientId);
  if (!client) return null;
  const physio = store.reservations.filter((r) => r.client_id === clientId && r.service_type === "fisioterapia");
  const physioIds = new Set(physio.map((r) => r.id));
  const notes = store.session_notes.filter((n) => physioIds.has(n.reservation_id));
  const visits = store.clinical_first_visits.filter((v) => v.client_id === clientId);
  const followups = store.clinical_followups.filter((f) => f.client_id === clientId);
  const hasHistory = visits.length > 0 || followups.length > 0 || notes.length > 0;
  const isDemo = isDemoClient(world, clientId);
  if (!hasHistory) return { hasHistory, isDemo, lastCareOn: null, purgeAfter: null };
  const now = Date.now();
  const past = physio
    .filter((r) => r.status !== "cancelled" && new Date(r.scheduled_at).getTime() <= now)
    .map((r) => r.scheduled_at)
    .sort();
  const entryTimes = [
    ...visits.flatMap((v) => [v.created_at, v.updated_at]),
    ...followups.flatMap((f) => [f.created_at, f.updated_at]),
    ...notes.map((n) => n.created_at),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const at = past.at(-1) ?? entryTimes.at(-1)!;
  const lastCareOn = centerDateStr(new Date(at));
  return { hasHistory, isDemo, lastCareOn, purgeAfter: plus15(lastCareOn) };
}

/** `archive_clinical_history` (i la còpia dels documents), en simulació. */
function mockArchive(clientId: string, actorId: string, world: DemoWorld): ArchiveOutcome {
  const store = getStore();
  const r = mockRetention(store, clientId, world);
  if (!r) throw new Error("Client no trobat.");
  if (!r.hasHistory || !r.lastCareOn || !r.purgeAfter) return { archived: false };
  // Per provar que una fallada de l'arxivat atura la baixa: MOCK_FAIL=clinical_archive.
  if (mockFails("clinical_archive"))
    throw new Error("No s'ha pogut arxivar l'historial clínic (simulat). No s'ha esborrat res.");
  const existing = store.clinical_archive_patients.find((p) => p.former_client_id === clientId);
  if (existing)
    return { archived: true, already: true, patientId: existing.id, isDemo: existing.is_demo, purgeAfter: r.purgeAfter };

  const client = store.clients.find((c) => c.id === clientId)!;
  const prof = store.profiles.find((p) => p.id === client.profile_id);
  const nameOf = (id: string | null) => store.profiles.find((p) => p.id === id)?.full_name ?? "—";
  const patientId = crypto.randomUUID();
  const purge = r.purgeAfter;
  const base = {
    patient_id: patientId,
    body: null,
    updated_at: null,
    session_on: null,
    source_id: null,
    storage_path: null,
    file_name: null,
    file_size: null,
    mime_type: null,
    description: null,
    consent_version: null,
    consent_revoked_at: null,
    purge_after: purge,
  };
  const entries: EntryRow[] = [];
  for (const v of store.clinical_first_visits.filter((x) => x.client_id === clientId))
    entries.push({ ...base, id: crypto.randomUUID(), kind: "first_visit", body: v.body, author_name: nameOf(v.created_by), written_at: v.created_at, updated_at: v.updated_at });
  for (const f of store.clinical_followups.filter((x) => x.client_id === clientId))
    entries.push({ ...base, id: crypto.randomUUID(), kind: "followup", body: f.body, author_name: nameOf(f.author_id), written_at: f.created_at, updated_at: f.updated_at, source_id: f.id });
  const physio = new Map(
    store.reservations.filter((x) => x.client_id === clientId && x.service_type === "fisioterapia").map((x) => [x.id, x]),
  );
  for (const n of store.session_notes.filter((x) => physio.has(x.reservation_id)))
    entries.push({ ...base, id: crypto.randomUUID(), kind: "session_note", body: n.body, author_name: nameOf(n.author_id), written_at: n.created_at, updated_at: n.updated_at, session_on: physio.get(n.reservation_id)!.scheduled_at, source_id: n.reservation_id });
  for (const d of store.client_documents.filter((x) => x.client_id === clientId))
    entries.push({ ...base, id: crypto.randomUUID(), kind: "document", author_name: prof?.full_name ?? "—", written_at: d.uploaded_at, source_id: d.id, storage_path: `${patientId}/${d.storage_path.split("/").pop()}`, file_name: d.file_name, file_size: d.file_size, mime_type: d.mime_type, description: d.description });
  for (const k of store.consents.filter((x) => x.user_id === client.profile_id && x.type === "health_data"))
    entries.push({ ...base, id: crypto.randomUUID(), kind: "consent", author_name: prof?.full_name ?? "—", written_at: k.granted_at, source_id: k.id, consent_version: k.version, consent_revoked_at: k.revoked_at ?? null });

  store.clinical_archive_patients.push({
    id: patientId,
    former_client_id: clientId,
    full_name: prof?.full_name ?? "—",
    birth_date: prof?.birth_date ?? null,
    email: prof?.email ?? null,
    phone: prof?.phone ?? null,
    last_care_on: r.lastCareOn,
    archived_at: new Date().toISOString(),
    archived_by: actorId,
    archived_by_name: nameOf(actorId),
    is_demo: r.isDemo,
  });
  store.clinical_archive_entries.push(...entries);
  store.data_access_log.push({
    id: crypto.randomUUID(),
    actor_id: actorId,
    subject_profile_id: client.profile_id,
    subject_label: `${prof?.full_name ?? "—"} <${prof?.email ?? ""}>`,
    action: "clinical_archive",
    details: `Arxivat fins al ${purge.split("-").reverse().join("/")}`,
    created_at: new Date().toISOString(),
  });
  saveStore(store);
  return { archived: true, patientId, purgeAfter: purge, isDemo: r.isDemo };
}

/** `clinical_archive_expired` + `purge_clinical_archive`, en simulació. */
function mockPurge(today: string): PurgeOutcome {
  const store = getStore();
  const gone = store.clinical_archive_entries.filter((e) => e.purge_after < today);
  if (!gone.length) return { expired: 0, purged: 0, filesRemoved: 0, filesFailed: 0 };
  const ids = new Set(gone.map((e) => e.id));
  store.clinical_archive_entries = store.clinical_archive_entries.filter((e) => !ids.has(e.id));
  const left = new Set(store.clinical_archive_entries.map((e) => e.patient_id));
  const fmt = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
  for (const p of store.clinical_archive_patients.filter((x) => !left.has(x.id)))
    store.data_access_log.push({
      id: crypto.randomUUID(),
      actor_id: null,
      subject_profile_id: null,
      subject_label: `Arxiu clínic ${p.id}`,
      action: "clinical_purge",
      details: `Purgat per venciment. Arxivat el ${fmt(p.archived_at)}; última atenció el ${fmt(p.last_care_on)}.`,
      created_at: new Date().toISOString(),
    });
  store.clinical_archive_patients = store.clinical_archive_patients.filter((p) => left.has(p.id));
  saveStore(store);
  return {
    expired: gone.length,
    purged: gone.length,
    filesRemoved: gone.filter((e) => e.storage_path).length,
    filesFailed: 0,
  };
}
