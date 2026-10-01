import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getStore, saveStore } from "@/lib/mock/store";
import { renderEmail } from "@/lib/notifications/templates";
import { RESEND_BATCH_MAX, sendEmailBatch, type BatchEmail, type BatchResult } from "@/lib/email";
import { toLocale } from "@/lib/i18n/config";
import type { NotificationRecipient } from "@/lib/notifications/types";

/**
 * El correu d'un anunci nou, a TOTHOM qui tingui 'community_email' activat.
 *
 * En dues passes:
 *
 *   1. `queueCommunity` (dins de l'acció, abans de tornar): llegeix els
 *      destinataris per pàgines i deixa una fila 'queued' per a cadascun al
 *      `notification_log`. A partir d'aquí el total ja es veu a l'anunci.
 *   2. `deliverCommunity` (a `after()`, quan l'admin ja té la resposta): envia
 *      en lots de 100 amb `/emails/batch` i passa cada fila a 'sent' o
 *      'failed' amb el motiu. Res no es perd en silenci: si s'esgota el límit
 *      diari de Resend, els que falten queden 'failed' amb aquest motiu; si el
 *      procés s'atura a mig camí, els que falten es queden 'queued' i la
 *      pantalla ho diu.
 *
 * Les preferències ja venen filtrades per la consulta (community_email =
 * true): no cal tornar-les a mirar destinatari per destinatari.
 */

export type CommunityPost = { announcementId: string; title: string; body: string };

/** Una fila del log, tal com es desa. L'`id` el posem nosaltres. */
export type CommunityLogRow = {
  id: string;
  profile_id: string | null;
  recipient: string | null;
  event_type: "community";
  channel: "email";
  status: "queued" | "sent" | "failed";
  error: string | null;
  related_id: string;
  provider_id: string | null;
  sent_at: string;
};

type Queued = { row: CommunityLogRow; recipient: NotificationRecipient };

const INSERT_CHUNK = 500;

/** Pas 1: destinataris + files 'queued'. Llança si no pot: l'acció ho diu. */
export async function queueCommunity(post: CommunityPost): Promise<Queued[]> {
  const recipients = await optedInRecipients();
  const now = new Date().toISOString();
  const queued: Queued[] = recipients.map((r) => ({
    recipient: r,
    row: {
      id: crypto.randomUUID(),
      profile_id: r.profileId,
      recipient: r.email,
      event_type: "community",
      channel: "email",
      status: "queued",
      error: null,
      related_id: post.announcementId,
      provider_id: null,
      sent_at: now,
    },
  }));
  await saveRows(queued.map((q) => q.row), "insert");
  return queued;
}

/**
 * Pas 2: envia i anota. Mai llança. `send` es pot substituir a les proves
 * (un transport fals); per defecte és Resend.
 */
export async function deliverCommunity(
  post: CommunityPost,
  queued: Queued[],
  send: (emails: BatchEmail[], key?: string) => Promise<BatchResult> = sendEmailBatch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  let quotaError: string | null = null;
  const finish = async (rows: CommunityLogRow[]) => {
    const at = new Date().toISOString();
    for (const r of rows) {
      r.sent_at = at;
      if (r.status === "sent") sent++;
      else failed++;
    }
    try {
      await saveRows(rows, "upsert");
    } catch (e) {
      console.error("[community] no s'ha pogut anotar el resultat d'un lot", e);
    }
  };

  // Sense adreça: fallit d'entrada, no fa nosa a cap lot.
  const noEmail = queued.filter((q) => !q.recipient.email);
  for (const q of noEmail) Object.assign(q.row, { status: "failed", error: "Sense adreça de correu" });
  if (noEmail.length) await finish(noEmail.map((q) => q.row));

  const withEmail = queued.filter((q) => q.recipient.email);
  for (let i = 0; i < withEmail.length; i += RESEND_BATCH_MAX) {
    const lot = withEmail.slice(i, i + RESEND_BATCH_MAX);
    let res: BatchResult;
    if (quotaError) {
      res = { ok: false, kind: "quota", error: quotaError };
    } else {
      const emails = lot.map(({ recipient }) => {
        const { subject, html, text } = renderEmail({
          type: "community",
          recipient,
          relatedId: post.announcementId,
          data: { name: recipient.name ?? "", title: post.title, body: post.body },
        });
        return { to: recipient.email!, subject, html, text };
      });
      const key = `community-${post.announcementId}-${i / RESEND_BATCH_MAX}`;
      res = await send(emails, key);
      // Massa peticions per segon: s'espera i es torna a provar (fins a 3
      // vegades). La clau d'idempotència evita que surti dues vegades.
      for (let t = 0; !res.ok && res.kind === "rate" && t < 3; t++) {
        await wait(res.retryAfterMs ?? 1000);
        res = await send(emails, key);
      }
      if (!res.ok && res.kind === "quota") quotaError = res.error;
    }
    for (const [j, q] of lot.entries()) {
      if (res.ok) Object.assign(q.row, { status: "sent", error: null, provider_id: res.ids[j] ?? null });
      else Object.assign(q.row, { status: "failed", error: res.error });
    }
    if (!res.ok) console.error(`[community] lot ${i / RESEND_BATCH_MAX + 1} fallit: ${res.error}`);
    await finish(lot.map((q) => q.row));
  }
  return { sent, failed };
}

async function saveRows(rows: CommunityLogRow[], mode: "insert" | "upsert"): Promise<void> {
  if (rows.length === 0) return;
  if (USE_MOCK) {
    const store = getStore();
    for (const r of rows) {
      const k = store.notification_log.findIndex((l) => l.id === r.id);
      if (k >= 0) store.notification_log[k] = { ...r };
      else store.notification_log.push({ ...r });
    }
    saveStore(store);
    return;
  }
  const admin = createAdminClient();
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } =
      mode === "insert"
        ? await admin.from("notification_log").insert(chunk)
        : await admin.from("notification_log").upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
}

/** Com va el correu de cada anunci: per a la llista de l'admin. */
export type CommunityDelivery = {
  total: number;
  sent: number;
  failed: number;
  queued: number;
  /** Un motiu d'error (el primer que es troba), per dir per què. */
  firstError: string | null;
};

/**
 * Comptadors del log per anunci (consultes de recompte, sense portar files).
 * Només per als anuncis que es passen: la llista en demana els recents.
 */
export async function getCommunityDelivery(ids: string[]): Promise<Map<string, CommunityDelivery>> {
  const out = new Map<string, CommunityDelivery>();
  if (ids.length === 0) return out;
  if (USE_MOCK) {
    const log = getStore().notification_log.filter((l) => l.event_type === "community" && l.channel === "email");
    for (const id of ids) {
      const rows = log.filter((l) => l.related_id === id && l.status !== "skipped_preference");
      out.set(id, {
        total: rows.length,
        sent: rows.filter((l) => l.status === "sent").length,
        failed: rows.filter((l) => l.status === "failed").length,
        queued: rows.filter((l) => l.status === "queued").length,
        firstError: rows.find((l) => l.status === "failed")?.error ?? null,
      });
    }
    return out;
  }
  const admin = createAdminClient();
  const count = async (id: string, status: string) => {
    const { count, error } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "community")
      .eq("channel", "email")
      .eq("related_id", id)
      .eq("status", status);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  await Promise.all(
    ids.map(async (id) => {
      const [sent, failed, queued] = await Promise.all([count(id, "sent"), count(id, "failed"), count(id, "queued")]);
      let firstError: string | null = null;
      if (failed > 0) {
        const { data } = await admin
          .from("notification_log")
          .select("error")
          .eq("event_type", "community")
          .eq("related_id", id)
          .eq("status", "failed")
          .order("sent_at", { ascending: false })
          .limit(1);
        firstError = data?.[0]?.error ?? null;
      }
      out.set(id, { total: sent + failed + queued, sent, failed, queued, firstError });
    }),
  );
  return out;
}

// El tipus del destinatari és el de sempre: així l'idioma no es pot
// perdre pel camí sense que el compilador ho digui.
type Rec = NotificationRecipient;

async function optedInRecipients(): Promise<Rec[]> {
  if (USE_MOCK) {
    const store = getStore();
    const ids = new Set(
      store.notification_preferences
        .filter((p) => p.community_email)
        .map((p) => p.profile_id),
    );
    return store.profiles
      .filter((p) => ids.has(p.id) && p.role !== "admin")
      .map((p) => ({
        profileId: p.id,
        email: p.email,
        phone: p.phone,
        name: p.full_name,
        // Aquest esdeveniment va a clients I a professionals dins del mateix
        // bucle. Amb l'idioma al destinatari, cadascú el rep en el seu sense
        // que el codi hagi de partir la llista en dues.
        locale: p.role === "client" ? toLocale(p.preferred_language) : null,
      }));
  }
  const admin = createAdminClient();
  type Row = {
    profile_id: string;
    profile: {
      email: string | null;
      phone: string | null;
      full_name: string | null;
      role: string;
      preferred_language: string | null;
    } | null;
  };
  // Per pàgines i en ordre estable: amb més de 1000 persones apuntades, una
  // sola consulta en perdria la resta sense dir res.
  const data = await fetchAllRows<Row>((from, to) =>
    admin
      .from("notification_preferences")
      .select(
        "profile_id, profile:profiles!notification_preferences_profile_id_fkey(email, phone, full_name, role, preferred_language)",
      )
      .eq("community_email", true)
      .order("profile_id")
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );
  return data
    .filter((r) => r.profile && r.profile.role !== "admin")
    .map((r) => ({
      profileId: r.profile_id,
      email: r.profile!.email,
      phone: r.profile!.phone,
      name: r.profile!.full_name,
      locale:
        r.profile!.role === "client"
          ? toLocale(r.profile!.preferred_language)
          : null,
    }));
}
