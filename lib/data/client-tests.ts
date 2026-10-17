import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";
import { byDate, titleKey, type BetterWhen, type EntryValues, type TestValues } from "@/lib/client-tests";

/**
 * Els tests d'avaluació d'un client (0113): cada test (títol lliure, unitat,
 * descripció, sentit de millora) amb els seus registres (data, valor,
 * observació). Sense catàleg: el test és del client.
 *
 * TOT va amb la sessió de qui crida: la RLS de la 0113 decideix (admin i el
 * professional ASSIGNAT escriuen; el client llegeix els seus; mai demo amb
 * real). Si no hi té permís, la lectura no torna res i l'escriptura falla o no
 * troba la fila, i aquí es converteix en error.
 *
 * Els errors de la base que les accions tradueixen:
 *   · 23505: el client ja té un test amb aquest títol (sense majúscules).
 *   · 23514: data futura.
 *   · 42501: sense permís.
 */

export type ClientTestEntry = {
  id: string;
  testId: string;
  measuredOn: string;
  value: number;
  notes: string | null;
  createdAt: string;
};

export type ClientTest = {
  id: string;
  title: string;
  unit: string | null;
  description: string | null;
  betterWhen: BetterWhen;
  position: number;
  /** En ordre cronològic (el més antic primer). */
  entries: ClientTestEntry[];
};

export type TestSuggestion = { title: string; unit: string | null; uses: number };

/** Un error amb el codi de Postgres, perquè el simulador falli com la base. */
function pgError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

type EntryRow = {
  id: string;
  test_id: string;
  measured_on: string;
  value: number | string;
  notes: string | null;
  created_at: string;
};

const toEntry = (r: EntryRow): ClientTestEntry => ({
  id: r.id,
  testId: r.test_id,
  measuredOn: r.measured_on,
  // numeric arriba com a text de PostgREST.
  value: Number(r.value),
  notes: r.notes,
  createdAt: r.created_at,
});

/** Els tests d'un client, en ordre, amb els registres de cadascun. */
export async function listClientTests(clientId: string): Promise<ClientTest[]> {
  let tests: {
    id: string;
    title: string;
    unit: string | null;
    description: string | null;
    better_when: BetterWhen;
    position: number;
  }[];
  let entries: EntryRow[];

  if (USE_MOCK) {
    const store = getStore();
    tests = store.client_tests.filter((t) => t.client_id === clientId);
    entries = store.client_test_entries.filter((e) => e.client_id === clientId);
  } else {
    const supabase = await createClient();
    const [testsRes, entriesRes] = await Promise.all([
      supabase
        .from("client_tests")
        .select("id, title, unit, description, better_when, position")
        .eq("client_id", clientId)
        .order("position"),
      supabase
        .from("client_test_entries")
        .select("id, test_id, measured_on, value, notes, created_at")
        .eq("client_id", clientId)
        .order("measured_on")
        .order("created_at"),
    ]);
    if (testsRes.error) throw testsRes.error;
    if (entriesRes.error) throw entriesRes.error;
    tests = testsRes.data ?? [];
    entries = entriesRes.data ?? [];
  }

  const byTest = new Map<string, ClientTestEntry[]>();
  for (const e of entries.map(toEntry)) {
    const list = byTest.get(e.testId) ?? [];
    list.push(e);
    byTest.set(e.testId, list);
  }
  return [...tests]
    .sort((a, b) => a.position - b.position)
    .map((t) => ({
      id: t.id,
      title: t.title,
      unit: t.unit,
      description: t.description,
      betterWhen: t.better_when,
      position: t.position,
      entries: (byTest.get(t.id) ?? []).sort(byDate),
    }));
}

/** Títols ja usats al centre, amb la unitat i quantes vegades (només equip). */
export async function listTestSuggestions(): Promise<TestSuggestion[]> {
  if (USE_MOCK) {
    // El simulador no sap de mons: tots els tests de la llavor.
    const groups = new Map<string, TestSuggestion>();
    for (const t of getStore().client_tests) {
      const key = `${titleKey(t.title)}|${(t.unit ?? "").toLowerCase()}`;
      const g = groups.get(key);
      if (g) g.uses++;
      else groups.set(key, { title: t.title, unit: t.unit, uses: 1 });
    }
    return [...groups.values()].sort((a, b) => b.uses - a.uses || a.title.localeCompare(b.title));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_test_suggestions");
  if (error) throw error;
  return (data ?? []).map((s) => ({ title: s.title, unit: s.unit, uses: Number(s.uses) }));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

function mockTitleTaken(clientId: string, title: string, exceptId?: string): boolean {
  return getStore().client_tests.some(
    (t) => t.client_id === clientId && t.id !== exceptId && titleKey(t.title) === titleKey(title),
  );
}

/** Crea un test al final de la llista del client. Torna l'id. */
export async function createClientTest(clientId: string, v: TestValues, createdBy: string): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    if (!store.clients.some((c) => c.id === clientId)) throw pgError("42501", "Client desconegut.");
    if (mockTitleTaken(clientId, v.title)) throw pgError("23505", "Títol repetit.");
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const mine = store.client_tests.filter((t) => t.client_id === clientId);
    store.client_tests.push({
      id,
      client_id: clientId,
      title: v.title,
      unit: v.unit,
      description: v.description,
      better_when: v.betterWhen,
      position: Math.max(0, ...mine.map((t) => t.position)) + 1,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    });
    saveStore(store);
    return id;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_tests")
    .insert({
      client_id: clientId,
      title: v.title,
      unit: v.unit,
      description: v.description,
      better_when: v.betterWhen,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Edita títol, unitat, descripció i sentit. El client i l'ordre es queden. */
export async function updateClientTest(id: string, v: TestValues): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const t = store.client_tests.find((x) => x.id === id);
    if (!t) throw pgError("P0002", "Aquest test ja no existeix.");
    if (mockTitleTaken(t.client_id, v.title, id)) throw pgError("23505", "Títol repetit.");
    Object.assign(t, {
      title: v.title,
      unit: v.unit,
      description: v.description,
      better_when: v.betterWhen,
      updated_at: new Date().toISOString(),
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_tests")
    .update({ title: v.title, unit: v.unit, description: v.description, better_when: v.betterWhen })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if ((data ?? []).length !== 1) throw pgError("P0002", "Aquest test ja no existeix.");
}

/** Esborra un test i, amb ell, tots els seus registres (`on delete cascade`). */
export async function deleteClientTest(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    if (!store.client_tests.some((t) => t.id === id)) throw pgError("P0002", "Aquest test ja no existeix.");
    store.client_tests = store.client_tests.filter((t) => t.id !== id);
    store.client_test_entries = store.client_test_entries.filter((e) => e.test_id !== id);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_tests").delete().eq("id", id).select("id");
  if (error) throw error;
  if ((data ?? []).length !== 1) throw pgError("P0002", "Aquest test ja no existeix.");
}

/** Nou ordre: la llista SENCERA dels tests del client. */
export async function reorderClientTests(clientId: string, ids: string[]): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const mine = store.client_tests.filter((t) => t.client_id === clientId);
    if (mine.length !== ids.length || new Set(ids).size !== ids.length || !ids.every((x) => mine.some((t) => t.id === x)))
      throw pgError("22023", "La llista de tests no quadra amb els tests del client.");
    ids.forEach((x, i) => {
      mine.find((t) => t.id === x)!.position = i + 1;
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_client_tests", { p_client: clientId, p_ids: ids });
  if (error) throw error;
}

// ─── Registres ──────────────────────────────────────────────────────────────

/** Afegeix un registre a un test. El client el posa la base, a partir del test. */
export async function addTestEntry(testId: string, v: EntryValues, createdBy: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const t = store.client_tests.find((x) => x.id === testId);
    if (!t) throw pgError("P0002", "Aquest test ja no existeix.");
    if (v.measuredOn > centerToday()) throw pgError("23514", "Data futura.");
    const now = new Date().toISOString();
    store.client_test_entries.push({
      id: crypto.randomUUID(),
      test_id: testId,
      client_id: t.client_id,
      measured_on: v.measuredOn,
      value: v.value,
      notes: v.notes,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_test_entries")
    .insert({ test_id: testId, measured_on: v.measuredOn, value: v.value, notes: v.notes });
  // Sense permís per veure el test, el trigger no en troba el client: la
  // columna queda nul·la (23502). Per a qui crida és el mateix que 42501.
  if (error?.code === "23502") throw pgError("42501", error.message);
  if (error) throw error;
}

/** Edita data, valor i observació d'un registre. El test no es canvia. */
export async function updateTestEntry(id: string, v: EntryValues): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const e = store.client_test_entries.find((x) => x.id === id);
    if (!e) throw pgError("P0002", "Aquest registre ja no existeix.");
    if (v.measuredOn > centerToday()) throw pgError("23514", "Data futura.");
    Object.assign(e, { measured_on: v.measuredOn, value: v.value, notes: v.notes, updated_at: new Date().toISOString() });
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_test_entries")
    .update({ measured_on: v.measuredOn, value: v.value, notes: v.notes })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if ((data ?? []).length !== 1) throw pgError("P0002", "Aquest registre ja no existeix.");
}

export async function deleteTestEntry(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    if (!store.client_test_entries.some((e) => e.id === id)) throw pgError("P0002", "Aquest registre ja no existeix.");
    store.client_test_entries = store.client_test_entries.filter((e) => e.id !== id);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_test_entries").delete().eq("id", id).select("id");
  if (error) throw error;
  if ((data ?? []).length !== 1) throw pgError("P0002", "Aquest registre ja no existeix.");
}
