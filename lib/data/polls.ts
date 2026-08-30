import "server-only";
import { centerToday } from "@/lib/center-time";
import { createClient } from "@/lib/supabase/server";
import { USE_MOCK } from "@/lib/config";
import { getStore, saveStore } from "@/lib/mock/store";

/**
 * Per què no es pot votar. Codis i no frases: la comunitat es veu en tres
 * idiomes i qui decideix el motiu és el servidor. Mateix criteri que a les
 * reserves i a la sessió de prova.
 */
export type PollErrorCode =
  | "closed"
  | "alreadyVoted"
  | "singleOnly"
  | "noOption"
  | "failed";

export class PollError extends Error {
  constructor(readonly code: PollErrorCode) {
    super(code);
    this.name = "PollError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PollOption = {
  id: string;
  label: string;
  sortOrder: number;
};

/** Una opció tal com la veu qui vota: amb quants vots té, sense qui els ha fet. */
export type PollOptionForClient = PollOption & { voteCount: number };

export type PollListItem = {
  id: string;
  question: string;
  allowMultiple: boolean;
  active: boolean;
  closesAt: string | null;
  createdAt: string;
  responseCount: number;
};

export type PollResult = {
  id: string;
  question: string;
  allowMultiple: boolean;
  active: boolean;
  closesAt: string | null;
  createdAt: string;
  options: {
    id: string;
    label: string;
    sortOrder: number;
    voteCount: number;
    voters: { clientId: string; clientName: string }[];
  }[];
};

export type PollForClient = {
  id: string;
  question: string;
  allowMultiple: boolean;
  active: boolean;
  closesAt: string | null;
  createdAt: string;
  options: PollOptionForClient[];
  myOptionIds: string[]; // empty = not voted yet
  /** Total de vots emesos a l'enquesta, per calcular els percentatges. */
  totalVotes: number;
  /**
   * Si l'enquesta ja no accepta respostes, decidit AL SERVIDOR.
   *
   * El client no ho pot calcular: `new Date()` al navegador és l'hora de qui
   * mira, i una enquesta del centre ha d'estar oberta o tancada igual per a
   * tothom. A més, així la pantalla i la validació de submitPollResponse
   * miren el mateix rellotge i no poden discrepar.
   */
  closed: boolean;
};

export type PollInput = {
  question: string;
  allowMultiple: boolean;
  closesAt: string | null; // ISO date string or null
  options: string[]; // labels
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listPolls(): Promise<PollListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    .select("id, question, allow_multiple, active, closes_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Count responses per poll
  const ids = (data ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: counts, error: cErr } = await supabase
    .from("poll_responses")
    .select("poll_id")
    .in("poll_id", ids);
  if (cErr) throw cErr;

  const countMap = new Map<string, number>();
  for (const r of counts ?? []) {
    countMap.set(r.poll_id, (countMap.get(r.poll_id) ?? 0) + 1);
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    question: p.question,
    allowMultiple: p.allow_multiple,
    active: p.active,
    closesAt: p.closes_at ?? null,
    createdAt: p.created_at,
    responseCount: countMap.get(p.id) ?? 0,
  }));
}

export async function getPollResult(id: string): Promise<PollResult | null> {
  const supabase = await createClient();

  const { data: poll, error: pErr } = await supabase
    .from("polls")
    .select("id, question, allow_multiple, active, closes_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!poll) return null;

  const { data: options, error: oErr } = await supabase
    .from("poll_options")
    .select("id, label, sort_order")
    .eq("poll_id", id)
    .order("sort_order");
  if (oErr) throw oErr;

  type ResponseRow = {
    option_id: string;
    client_id: string;
    client: { profile: { full_name: string | null } | null } | null;
  };
  const { data: responses, error: rErr } = await supabase
    .from("poll_responses")
    .select(
      "option_id, client_id, client:clients!poll_responses_client_id_fkey(profile:profiles!clients_profile_id_fkey(full_name))",
    )
    .eq("poll_id", id);
  if (rErr) throw rErr;

  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allow_multiple,
    active: poll.active,
    closesAt: poll.closes_at ?? null,
    createdAt: poll.created_at,
    options: (options ?? []).map((o) => {
      const votes = ((responses ?? []) as unknown as ResponseRow[]).filter(
        (r) => r.option_id === o.id,
      );
      return {
        id: o.id,
        label: o.label,
        sortOrder: o.sort_order,
        voteCount: votes.length,
        voters: votes.map((r) => ({
          clientId: r.client_id,
          clientName: r.client?.profile?.full_name ?? "—",
        })),
      };
    }),
  };
}

export async function createPoll(
  input: PollInput,
  createdBy: string,
): Promise<string> {
  const supabase = await createClient();

  const { data: poll, error: pErr } = await supabase
    .from("polls")
    .insert({
      question: input.question,
      allow_multiple: input.allowMultiple,
      active: true,
      created_by: createdBy,
      closes_at: input.closesAt ?? null,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;

  const { error: oErr } = await supabase.from("poll_options").insert(
    input.options.map((label, i) => ({
      poll_id: poll.id,
      label,
      sort_order: i,
    })),
  );
  if (oErr) throw oErr;

  return poll.id;
}

export async function closePoll(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("polls")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePoll(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", id);
  if (error) throw error;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export async function listPollsForClient(
  clientId: string,
): Promise<PollForClient[]> {
  if (USE_MOCK) return listPollsForClientMock(clientId);
  const supabase = await createClient();

  const { data: polls, error: pErr } = await supabase
    .from("polls")
    .select(
      "id, question, allow_multiple, active, closes_at, created_at, poll_options(id, label, sort_order)",
    )
    .order("created_at", { ascending: false });
  if (pErr) throw pErr;

  const pollIds = (polls ?? []).map((p) => p.id);
  if (pollIds.length === 0) return [];

  const { data: myResponses, error: rErr } = await supabase
    .from("poll_responses")
    .select("poll_id, option_id")
    .eq("client_id", clientId)
    .in("poll_id", pollIds);
  if (rErr) throw rErr;

  const countByOption = await voteCounts(supabase, pollIds);

  const myMap = new Map<string, string[]>();
  for (const r of myResponses ?? []) {
    const arr = myMap.get(r.poll_id) ?? [];
    arr.push(r.option_id);
    myMap.set(r.poll_id, arr);
  }

  type PollRow = {
    id: string;
    question: string;
    allow_multiple: boolean;
    active: boolean;
    closes_at: string | null;
    created_at: string;
    poll_options: { id: string; label: string; sort_order: number }[];
  };

  return (polls as unknown as PollRow[]).map((p) => ({
    id: p.id,
    question: p.question,
    allowMultiple: p.allow_multiple,
    active: p.active,
    closesAt: p.closes_at ?? null,
    createdAt: p.created_at,
    options: (p.poll_options ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({
        id: o.id,
        label: o.label,
        sortOrder: o.sort_order,
        voteCount: countByOption.get(o.id) ?? 0,
      })),
    myOptionIds: myMap.get(p.id) ?? [],
    totalVotes: (p.poll_options ?? []).reduce(
      (n, o) => n + (countByOption.get(o.id) ?? 0),
      0,
    ),
    closed: !p.active || (p.closes_at != null && p.closes_at < centerToday()),
  }));
}

/**
 * Quants vots té cada opció.
 *
 * Va per RPC i no per consulta directa perquè la RLS de `poll_responses` només
 * deixa veure les teves: qui vota no ha de poder llegir qui ha votat què. La
 * funció és SECURITY DEFINER i torna NOMÉS el recompte —cap `client_id` surt
 * d'allà dins—. Vegeu la migració 0059.
 *
 * Si la funció encara no hi és (migració sense aplicar), es torna un mapa buit
 * en comptes de petar: la comunitat s'ha de poder llegir igualment, i la
 * pantalla amaga els percentatges quan no hi ha cap vot.
 */
async function voteCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pollIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { data, error } = await supabase.rpc("poll_option_counts", {
    p_poll_ids: pollIds,
  });
  if (error) return out;
  for (const row of (data ?? []) as { option_id: string; votes: number }[])
    out.set(row.option_id, Number(row.votes));
  return out;
}

/** La mateixa forma, sobre el magatzem de simulació. */
function listPollsForClientMock(clientId: string): PollForClient[] {
  const store = getStore();
  const today = centerToday();
  return store.polls
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((p) => {
      const options = store.poll_options
        .filter((o) => o.poll_id === p.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => ({
          id: o.id,
          label: o.label,
          sortOrder: o.sort_order,
          voteCount: store.poll_responses.filter((r) => r.option_id === o.id)
            .length,
        }));
      return {
        id: p.id,
        question: p.question,
        allowMultiple: p.allow_multiple,
        active: p.active,
        closesAt: p.closes_at ?? null,
        createdAt: p.created_at,
        options,
        myOptionIds: store.poll_responses
          .filter((r) => r.poll_id === p.id && r.client_id === clientId)
          .map((r) => r.option_id),
        totalVotes: options.reduce((n, o) => n + o.voteCount, 0),
        closed: !p.active || (p.closes_at != null && p.closes_at < today),
      };
    });
}

export async function submitPollResponse(
  pollId: string,
  optionIds: string[],
  clientId: string,
): Promise<void> {
  if (USE_MOCK) return submitPollResponseMock(pollId, optionIds, clientId);
  const supabase = await createClient();

  // Verify poll is still active and not expired
  const { data: poll, error: pErr } = await supabase
    .from("polls")
    .select("active, allow_multiple, closes_at")
    .eq("id", pollId)
    .single();
  if (pErr) throw pErr;

  const today = centerToday();
  if (!poll.active || (poll.closes_at && poll.closes_at < today)) {
    throw new PollError("closed");
  }

  // Check not already voted
  const { data: existing } = await supabase
    .from("poll_responses")
    .select("id")
    .eq("poll_id", pollId)
    .eq("client_id", clientId)
    .limit(1);
  if ((existing ?? []).length > 0) {
    throw new PollError("alreadyVoted");
  }

  // Validate single-choice constraint
  if (!poll.allow_multiple && optionIds.length !== 1) {
    throw new PollError("singleOnly");
  }
  if (optionIds.length === 0) {
    throw new PollError("noOption");
  }

  const { error: iErr } = await supabase.from("poll_responses").insert(
    optionIds.map((option_id) => ({
      poll_id: pollId,
      option_id,
      client_id: clientId,
    })),
  );
  if (iErr) throw iErr;
}

/** El mateix vot, i les mateixes negatives, sobre el magatzem de simulació. */
function submitPollResponseMock(
  pollId: string,
  optionIds: string[],
  clientId: string,
): void {
  const store = getStore();
  const poll = store.polls.find((p) => p.id === pollId);
  if (!poll) throw new PollError("failed");

  const today = centerToday();
  if (!poll.active || (poll.closes_at && poll.closes_at < today))
    throw new PollError("closed");

  if (store.poll_responses.some((r) => r.poll_id === pollId && r.client_id === clientId))
    throw new PollError("alreadyVoted");

  if (!poll.allow_multiple && optionIds.length !== 1)
    throw new PollError("singleOnly");
  if (optionIds.length === 0) throw new PollError("noOption");

  for (const option_id of optionIds)
    store.poll_responses.push({
      id: crypto.randomUUID(),
      poll_id: pollId,
      option_id,
      client_id: clientId,
      responded_at: new Date().toISOString(),
    });
  saveStore(store);
}
